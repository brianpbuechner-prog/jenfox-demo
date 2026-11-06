"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { POLLS_CLOSE_UTC } from "@/lib/electionNight";
import {
  PLACES, PRECINCTS, PRECINCT_BY_KEY, lastName, n, pace, pct1, signedMargin, two,
  type Feed, type FeedPrecinct, type TickerItem,
} from "@/lib/partyFeed";
import { armAudio, audioArmed, chime, type ChimeKind } from "./partyChimes";
import { SIM_MOVIE_SECONDS, SIM_SPEED, SIM_START, SIM_DOGS, SIM_POSTS, simPrecincts } from "./partySim";
import PartyWall from "./PartyWall";
import PartyDogs, { DOG_RUN_MS } from "./PartyDogs";
import type { WallPost } from "@/lib/partyPosts";

// The whole election night on one page: countdown, a 10 second "polls are closed" hold, the
// movie (a file picked from this laptop, never uploaded), then the results tracker. It moves on
// by itself; /party/control on Brian's phone can force any state. It never calls the race.

type Mode = "countdown" | "closed" | "movie" | "tracker";
type Card = { id: number; size: "full" | "corner"; chime: ChimeKind; kicker: string; title: string; lines: string[]; ms?: number };
type View = {
  mode: Feed["mode"]; names: { d: string; r: string }; totals: { d: number; r: number };
  reportedCount: number; totalCount: number; precincts: FeedPrecinct[];
};
type Trig = { seen: Set<string>; count: number; ms: Set<string>; lastMode: Feed["mode"] };

const POSTS_MS = 5_000, PHOTO_URL_MAX_MS = 30 * 60_000;
const SHOW_NAMES = true;
const HOLD_MS = 10_000, CARD_MS = 20_000, FEED_MS = 60_000, CMD_MS = 3_000, TICK_MS = 20_000, BANNER_MS = 60_000;
const SEEN_KEY = "party-triggers-2026-11-03";
const BANNERS: [number, string][] = [
  [POLLS_CLOSE_UTC - 60 * 60_000, "One hour left. Polls close at 8."],
  [POLLS_CLOSE_UTC - 30 * 60_000, "Thirty minutes."],
];
const HASTINGS = PRECINCTS.filter((p) => p.place === "Hastings").map((p) => p.key);
const COTTAGE = PRECINCTS.filter((p) => p.place === "Cottage Grove").map((p) => p.key);

const pad = (v: number) => String(v).padStart(2, "0");
const mmss = (s: number) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
const ctTime = (s: string | null | undefined) => {
  if (!s) return "";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
};
const emptyTrig = (): Trig => ({ seen: new Set(), count: 0, ms: new Set(), lastMode: "none" });
const store = {
  get(): Trig | null {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (!raw) return null;
      const j = JSON.parse(raw) as { seen: string[]; count: number; ms: string[]; lastMode: Feed["mode"] };
      return { seen: new Set(j.seen), count: j.count, ms: new Set(j.ms), lastMode: j.lastMode };
    } catch { return null; }
  },
  set(t: Trig) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ seen: [...t.seen], count: t.count, ms: [...t.ms], lastMode: t.lastMode })); } catch { /* private window */ }
  },
  clear() { try { localStorage.removeItem(SEEN_KEY); } catch { /* ignore */ } },
};

export default function PartyScreen({ sim, screen }: { sim: boolean; screen: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const t0 = useRef(0);

  const [mode, setModeState] = useState<Mode | null>(null);
  const modeRef = useRef<Mode | null>(null);
  const setMode = useCallback((m: Mode) => { modeRef.current = m; setModeState(m); }, []);
  const [now, setNow] = useState<number | null>(null);
  const prevNow = useRef<number | null>(null);
  const closedFired = useRef(false);
  const bannerFired = useRef(new Set<number>());
  const [banner, setBanner] = useState<string | null>(null);

  const [feed, setFeed] = useState<Feed | null>(null);
  const [feedErr, setFeedErr] = useState<string | null>(null);
  const [cmdStatus, setCmdStatus] = useState<{ ok: boolean; at: number; error?: string } | null>(null);
  const [national, setNational] = useState("");
  const [tick, setTick] = useState(0);

  const [movieUrl, setMovieUrl] = useState<string | null>(null);
  const [movieName, setMovieName] = useState("");
  const [movieDur, setMovieDur] = useState<number | null>(null);
  const [placeholderLeft, setPlaceholderLeft] = useState(0);
  const [armed, setArmed] = useState(false);
  const [panel, setPanel] = useState(screen);

  const trackerStart = useRef<number | null>(null);
  const [simSecs, setSimSecs] = useState(-1);

  const queue = useRef<Card[]>([]);
  const [queueLen, setQueueLen] = useState(0);
  const [card, setCard] = useState<Card | null>(null);
  const lastCard = useRef<Card | null>(null);
  const cardId = useRef(0);
  const trig = useRef<Trig>(emptyTrig());

  // Message wall and dog run
  const [wallOn, setWallOn] = useState(true);
  const wallOnRef = useRef(true);
  wallOnRef.current = wallOn;
  const [realPosts, setRealPosts] = useState<WallPost[]>([]);
  const [samplePosts, setSamplePosts] = useState<WallPost[]>([]);
  const [fresh, setFresh] = useState<WallPost[]>([]);
  const [postsStatus, setPostsStatus] = useState<{ ok: boolean; at: number; error?: string } | null>(null);
  const photoUrls = useRef(new Map<string, { url: string; at: number }>());
  const [dogRun, setDogRun] = useState(0);
  const dogsWanted = useRef(false);
  const dogsBusyUntil = useRef(0);

  const clock = useCallback(() => (sim ? SIM_START + (performance.now() - t0.current) * SIM_SPEED : Date.now()), [sim]);

  // ---- start -----------------------------------------------------------------------
  useEffect(() => {
    t0.current = performance.now();
    const before = Date.now() < POLLS_CLOSE_UTC;
    if (!sim) {
      if (before) store.clear();
      else trig.current = emptyTrig(); // demo: start fresh on every visit
    }
    if (sim || before) setMode("countdown");
    else { closedFired.current = true; setMode("tracker"); }
    setNow(clock());
    const t = setInterval(() => setNow(clock()), 250);
    return () => clearInterval(t);
  }, [sim, clock, setMode]);

  // ---- queue and cards ---------------------------------------------------------------
  const enqueue = useCallback((cards: Omit<Card, "id">[], front = false) => {
    const withIds = cards.map((c) => ({ ...c, id: ++cardId.current }));
    queue.current = front ? [...withIds, ...queue.current] : [...queue.current, ...withIds];
    setQueueLen(queue.current.length);
  }, []);

  useEffect(() => {
    if (card || mode === "movie" || mode === "closed" || !queue.current.length) return;
    const next = queue.current.shift()!;
    setQueueLen(queue.current.length);
    lastCard.current = next;
    setCard(next);
    chime(next.chime);
  }, [card, queueLen, mode]);

  useEffect(() => {
    if (!card) return;
    // A precinct card shortens to 10 seconds when two or more cards are waiting behind it.
    const ms = card.ms ?? (card.size === "corner" && queue.current.length >= 2 ? CARD_MS / 2 : CARD_MS);
    const t = setTimeout(() => setCard(null), ms);
    return () => clearTimeout(t);
  }, [card]);

  // ---- movie -----------------------------------------------------------------------
  const startMovie = useCallback(() => {
    setCard(null);
    if (movieUrl || sim) setMode("movie");
    else setMode("tracker");
  }, [movieUrl, sim, setMode]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (mode === "movie" && movieUrl) {
      v.currentTime = 0;
      v.play().catch(() => setMode("tracker"));
    } else if (!v.paused) v.pause();
  }, [mode, movieUrl, setMode]);

  // Rehearsal with no file loaded: a short placeholder stands in for the movie.
  useEffect(() => {
    if (mode !== "movie" || movieUrl) return;
    if (!sim) { setMode("tracker"); return; }
    let left = SIM_MOVIE_SECONDS;
    setPlaceholderLeft(left);
    const t = setInterval(() => {
      left -= 1;
      setPlaceholderLeft(left);
      if (left <= 0) { clearInterval(t); setMode("tracker"); }
    }, 1000);
    return () => clearInterval(t);
  }, [mode, movieUrl, sim, setMode]);

  const loadMovie = (f: File | undefined) => {
    if (!f) return;
    if (movieUrl) URL.revokeObjectURL(movieUrl);
    setMovieDur(null);
    setMovieName(f.name);
    setMovieUrl(URL.createObjectURL(f));
  };

  // ---- countdown: banners, close, hold ---------------------------------------------------
  useEffect(() => {
    if (now === null) return;
    const prev = prevNow.current;
    prevNow.current = now;
    if (prev === null || mode !== "countdown") return;
    for (const [at, text] of BANNERS) {
      if (prev < at && now >= at && !bannerFired.current.has(at)) {
        bannerFired.current.add(at);
        setBanner(text);
        chime("soft");
        setTimeout(() => setBanner((b) => (b === text ? null : b)), BANNER_MS);
      }
    }
    if (!closedFired.current && prev < POLLS_CLOSE_UTC && now >= POLLS_CLOSE_UTC) {
      closedFired.current = true;
      setBanner(null);
      if (!sim) { trig.current = emptyTrig(); store.clear(); }
      setMode("closed");
      chime("big");
    }
  }, [now, mode, sim, setMode]);

  useEffect(() => {
    if (mode !== "closed") return;
    const t = setTimeout(startMovie, HOLD_MS);
    return () => clearTimeout(t);
  }, [mode, startMovie]);

  // ---- results feed ------------------------------------------------------------------
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch("/api/party/results", { cache: "no-store" });
        if (!res.ok) throw new Error(`Feed returned ${res.status}`);
        const j = (await res.json()) as Feed;
        if (!stop) { setFeed(j); setFeedErr(j.ok ? null : j.errors.join("; ") || "State files not readable"); }
      } catch (e) {
        if (!stop) setFeedErr((e as Error).message);
      }
    };
    void load();
    const t = setInterval(load, FEED_MS);
    return () => { stop = true; clearInterval(t); };
  }, []);

  // Rehearsal precincts start arriving when the tracker first shows.
  useEffect(() => {
    if (!sim || mode !== "tracker" || trackerStart.current !== null) return;
    trackerStart.current = performance.now();
  }, [sim, mode]);
  useEffect(() => {
    if (!sim) return;
    const t = setInterval(() => {
      if (trackerStart.current !== null) setSimSecs(Math.floor((performance.now() - trackerStart.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [sim]);

  const view: View = useMemo(() => {
    const names = feed?.names || { d: "Jen Fox", r: "Republican" };
    if (sim) {
      const precincts = simPrecincts(simSecs);
      const rep = precincts.filter((p) => p.reported);
      return {
        mode: "precinct", names, precincts, reportedCount: rep.length, totalCount: PRECINCTS.length,
        totals: { d: rep.reduce((a, p) => a + p.d, 0), r: rep.reduce((a, p) => a + p.r, 0) },
      };
    }
    if (!feed) return { mode: "none", names, precincts: [], reportedCount: 0, totalCount: PRECINCTS.length, totals: { d: 0, r: 0 } };
    return { mode: feed.mode, names, precincts: feed.precincts, reportedCount: feed.reportedCount, totalCount: feed.totalCount, totals: feed.totals };
  }, [feed, sim, simSecs]);

  // ---- triggers ------------------------------------------------------------------------
  useEffect(() => {
    if (mode !== "tracker") return;
    if (!sim && Date.now() < POLLS_CLOSE_UTC) return;
    const st = trig.current;
    const dN = lastName(view.names.d), rN = lastName(view.names.r);
    const p = pace(view.precincts);
    const paceTxt = p ? `${p.read === "ahead" ? "Ahead of" : p.read === "on" ? "On" : "Behind"} tie pace (estimate)` : "";
    const totalsTxt = `${dN} ${n(view.totals.d)} · ${rN} ${n(view.totals.r)}`;
    const cards: Omit<Card, "id">[] = [];

    if (view.mode === "precinct") {
      if (st.lastMode === "summary") for (const pr of view.precincts) if (pr.reported) st.seen.add(pr.key);
      let count = st.seen.size;
      for (const pr of view.precincts) {
        if (!pr.reported || st.seen.has(pr.key)) continue;
        st.seen.add(pr.key);
        count++;
        const name = PRECINCT_BY_KEY.get(pr.key)?.name || pr.key;
        if (!st.ms.has("first")) {
          st.ms.add("first");
          cards.push({ size: "full", chime: "big", kicker: "MN House 41B", title: "First results", lines: [name, `${dN} ${n(pr.d)}`, `${rN} ${n(pr.r)}`] });
        } else {
          cards.push({ size: "corner", chime: "soft", kicker: `${count} of ${view.totalCount} in`, title: name, lines: [`${dN} ${n(pr.d)} · ${rN} ${n(pr.r)}`, paceTxt].filter(Boolean) });
        }
      }
      if (!st.ms.has("cg") && COTTAGE.every((k) => st.seen.has(k))) {
        st.ms.add("cg");
        const c = view.precincts.filter((x) => COTTAGE.includes(x.key));
        cards.push({ size: "full", chime: "medium", kicker: `${COTTAGE.length} of ${COTTAGE.length} precincts`, title: "All Cottage Grove in", lines: [`Cottage Grove: ${dN} ${n(c.reduce((a, x) => a + x.d, 0))} · ${rN} ${n(c.reduce((a, x) => a + x.r, 0))}`] });
      }
      if (!st.ms.has("hastings") && HASTINGS.every((k) => st.seen.has(k))) {
        st.ms.add("hastings");
        const h = view.precincts.filter((x) => HASTINGS.includes(x.key));
        cards.push({ size: "full", chime: "medium", kicker: `${HASTINGS.length} of ${HASTINGS.length} precincts`, title: "All Hastings in", lines: [`Hastings: ${dN} ${n(h.reduce((a, x) => a + x.d, 0))} · ${rN} ${n(h.reduce((a, x) => a + x.r, 0))}`] });
      }
    } else if (view.mode === "summary" && view.reportedCount > st.count) {
      if (!st.ms.has("first")) {
        st.ms.add("first");
        cards.push({ size: "full", chime: "big", kicker: "MN House 41B", title: "First results", lines: [`${view.reportedCount} of ${view.totalCount} precincts in`, `${dN} ${n(view.totals.d)}`, `${rN} ${n(view.totals.r)}`] });
      } else {
        cards.push({ size: "corner", chime: "soft", kicker: "MN House 41B", title: `${view.reportedCount} of ${view.totalCount} in`, lines: [totalsTxt] });
      }
    }
    if (view.mode !== "none") {
      st.count = Math.max(st.count, view.reportedCount);
      st.lastMode = view.mode;
    }
    const total = view.totalCount;
    if (view.reportedCount > 0 && view.reportedCount < total && view.reportedCount >= Math.ceil(total / 2) && !st.ms.has("half")) {
      st.ms.add("half");
      cards.push({ size: "full", chime: "medium", kicker: `${view.reportedCount} of ${total} precincts in`, title: "Halfway", lines: [totalsTxt] });
    }
    if (total > 0 && view.reportedCount >= total && !st.ms.has("all")) {
      st.ms.add("all");
      cards.push({ size: "full", chime: "big", kicker: `${total} of ${total}`, title: "All precincts reporting", lines: [`${view.names.d} ${n(view.totals.d)}`, `${view.names.r} ${n(view.totals.r)}`] });
    }
    // Portfolio demo: the feed is the final result, so skip the night's build-up. Show only the
    // all-in card, 5 seconds after the page opens, for 5 seconds. Not remembered, so every visit sees it.
    if (!sim) {
      const all = cards.find((c) => c.title === "All precincts reporting");
      if (all) setTimeout(() => enqueue([{ ...all, ms: 5_000 }]), 5_000);
      return;
    }
    if (cards.length) enqueue(cards);
  }, [view, mode, sim, enqueue]);

  // ---- message wall ------------------------------------------------------------------------
  // Every tab polls (view-only tabs too; reading is harmless). New posts after the first poll
  // flash in.
  const [dogNudge, setDogNudge] = useState(0);
  const requestDogs = useCallback(() => { dogsWanted.current = true; setDogNudge((x) => x + 1); }, []);
  useEffect(() => {
    let stop = false, first = true;
    const known = new Set<string>();
    const load = async () => {
      try {
        const res = await fetch("/api/party/posts", { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; error?: string; posts?: WallPost[] };
        if (stop) return;
        if (!j.ok) throw new Error(j.error || `Posts returned ${res.status}`);
        const nowMs = Date.now();
        const list = (j.posts || []).map((p) => {
          if (!p.photo) return p;
          // Reuse a photo URL for up to 30 minutes so the image is not fetched again every poll.
          const c = photoUrls.current.get(p.photo.id);
          if (c && nowMs - c.at < PHOTO_URL_MAX_MS) return { ...p, photo: { ...p.photo, url: c.url } };
          photoUrls.current.set(p.photo.id, { url: p.photo.url, at: nowMs });
          return p;
        });
        const added = list.filter((p) => !known.has(p.id));
        for (const p of list) known.add(p.id);
        setRealPosts(list);
        if (!first && added.length) {
          setFresh((f) => [...f, ...added.slice().reverse()].slice(-20));
        }
        first = false;
        setPostsStatus({ ok: true, at: nowMs });
      } catch (e) {
        if (!stop) setPostsStatus({ ok: false, at: Date.now(), error: (e as Error).message });
      }
    };
    void load();
    const t = setInterval(load, POSTS_MS);
    return () => { stop = true; clearInterval(t); };
  }, [requestDogs]);

  // Rehearsal: made-up posts, labeled Sample, kept in this browser only. Never written to Airtable.
  useEffect(() => {
    if (!sim) return;
    const timers = SIM_POSTS.map((sp, i) => setTimeout(() => {
      const post: WallPost = { id: `sample-${i}`, name: sp.name, message: sp.message, photo: sp.photo ? { id: `sample-photo-${i}`, url: sp.photo, thumb: sp.photo } : null, hidden: false, flag: "", createdTime: new Date().toISOString(), sample: true };
      setSamplePosts((list) => [post, ...list]);
      setFresh((f) => [...f, post].slice(-20));
    }, sp.at * 1000));
    const dogTimers = SIM_DOGS.map((secs) => setTimeout(requestDogs, secs * 1000));
    return () => { timers.forEach(clearTimeout); dogTimers.forEach(clearTimeout); };
  }, [sim, requestDogs]);

  // Dogs run at random every 30 to 45 minutes (40 to 70 seconds in rehearsal), or from the
  // Run the dogs button / D key. New posts no longer send them.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      const ms = sim ? (40 + Math.random() * 30) * 1000 : (30 + Math.random() * 15) * 60_000;
      t = setTimeout(() => { requestDogs(); next(); }, ms);
    };
    next();
    return () => clearTimeout(t);
  }, [sim, requestDogs]);

  // A run waits until the screen is on the countdown or tracker with no full-screen card up.
  const dogsAllowed = (mode === "countdown" || mode === "tracker") && !(card && card.size === "full");
  useEffect(() => {
    if (!dogsWanted.current || !dogsAllowed) return;
    const wait = dogsBusyUntil.current - Date.now();
    if (wait > 0) {
      const t = setTimeout(() => setDogNudge((x) => x + 1), wait + 50);
      return () => clearTimeout(t);
    }
    dogsWanted.current = false;
    dogsBusyUntil.current = Date.now() + DOG_RUN_MS;
    setDogRun((x) => x + 1);
  }, [dogNudge, dogsAllowed]);
  const posts = useMemo(() => [...samplePosts, ...realPosts].sort((a, b) => b.createdTime.localeCompare(a.createdTime)).slice(0, 50), [samplePosts, realPosts]);
  const showWall = wallOn && (mode === "countdown" || mode === "tracker");

  // ---- phone control -------------------------------------------------------------------
  const startMovieRef = useRef(startMovie);
  startMovieRef.current = startMovie;
  useEffect(() => {
    // Only the bar screen (?screen=1) takes remote commands; a view-only tab would steal them.
    if (!screen) return;
    let stop = false, polls = 0, lastHbMode: Mode | null = null, first = true;
    const poll = async () => {
      const m = modeRef.current;
      const hb = polls++ % 5 === 0 || m !== lastHbMode;
      try {
        const res = await fetch(`/api/party/command?state=${m || "loading"}${hb ? "&hb=1" : ""}${sim ? "&sim=1" : ""}&wall=${wallOnRef.current ? 1 : 0}`, { cache: "no-store" });
        const j = (await res.json()) as { ok: boolean; error?: string; commands?: { command: string; payload: string; sentAt: string }[] };
        if (stop) return;
        if (!j.ok) throw new Error(j.error || `Control returned ${res.status}`);
        if (hb) lastHbMode = m;
        setCmdStatus({ ok: true, at: Date.now() });
        for (const c of j.commands || []) {
          // Anything sent more than two minutes before this screen opened is stale, so it is skipped.
          if (first && Date.now() - Date.parse(c.sentAt) > 120_000) continue;
          if (c.command === "chime") chime("medium");
          else if (c.command === "countdown") { setCard(null); setMode("countdown"); }
          else if (c.command === "movie") startMovieRef.current();
          else if (c.command === "tracker") setMode("tracker");
          else if (c.command === "replay") { if (lastCard.current) enqueue([{ ...lastCard.current }], true); }
          else if (c.command === "announce" && c.payload.trim()) enqueue([{ size: "full", chime: "medium", kicker: "Announcement", title: c.payload.trim(), lines: [] }], true);
          else if (c.command === "national") setNational(c.payload.trim());
          else if (c.command === "dogs") requestDogs();
          else if (c.command === "wall") { const on = c.payload !== "off"; wallOnRef.current = on; setWallOn(on); lastHbMode = null; }
        }
        first = false;
      } catch (e) {
        if (!stop) setCmdStatus({ ok: false, at: Date.now(), error: (e as Error).message });
      }
    };
    void poll();
    const t = setInterval(poll, CMD_MS);
    return () => { stop = true; clearInterval(t); };
  }, [sim, screen, setMode, enqueue, requestDogs]);

  // ---- keyboard: Space pauses the movie; S setup; F full screen; 1/2/3 force a state ------
  const fullScreen = useCallback(() => {
    const el = root.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!screen) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space" && modeRef.current === "movie") {
        e.preventDefault();
        const v = video.current;
        if (v) { if (v.paused) void v.play(); else v.pause(); }
      } else if (e.key === "s" || e.key === "S") setPanel((p) => !p);
      else if (e.key === "f" || e.key === "F") fullScreen();
      else if (e.key === "w" || e.key === "W") setWallOn((x) => !x);
      else if (e.key === "d" || e.key === "D") requestDogs();
      else if (e.key === "1") { setCard(null); setMode("countdown"); }
      else if (e.key === "2") startMovieRef.current();
      else if (e.key === "3") setMode("tracker");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullScreen, setMode, screen, requestDogs]);

  // ---- ticker ------------------------------------------------------------------------
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), TICK_MS);
    return () => clearInterval(t);
  }, []);
  const tickerItems: TickerItem[] = [...(feed?.ticker || []), ...(national ? [{ label: "National", text: national }] : [])];
  const tickerItem = tickerItems.length ? tickerItems[tick % tickerItems.length] : null;

  // ---- render --------------------------------------------------------------------------
  const left = now === null ? null : Math.max(0, POLLS_CLOSE_UTC - now);
  const s = left === null ? 0 : Math.floor(left / 1000);
  const label = sim ? "REHEARSAL · MADE-UP NUMBERS" : Date.now() < POLLS_CLOSE_UTC ? "TEST DATA · NOT RESULTS" : null;
  const { d, r } = view.totals;
  const anyIn = view.reportedCount > 0;
  const allIn = view.totalCount > 0 && view.reportedCount >= view.totalCount;
  const p = pace(view.precincts);
  const repKeys = new Set(view.precincts.filter((x) => x.reported).map((x) => x.key));

  return (
    <div ref={root} className={`ps ps-${mode || "loading"}${showWall ? " ps-wall" : ""}`}>
      {mode === "countdown" && (
        <div className="ps-center">
          <div className="ps-kicker">Jen Fox for House, 41B</div>
          {left === null ? null : left === 0 ? (
            <div className="ps-closed-title">Polls are closed</div>
          ) : (
            <div className="ps-clock" aria-label={`${Math.floor(s / 3600)} hours, ${Math.floor((s % 3600) / 60)} minutes, ${s % 60} seconds`}>
              <span className="ps-unit"><b>{Math.floor(s / 3600)}</b><i>hours</i></span>
              <span className="ps-sep">:</span>
              <span className="ps-unit"><b>{pad(Math.floor((s % 3600) / 60))}</b><i>minutes</i></span>
              <span className="ps-sep">:</span>
              <span className="ps-unit"><b>{pad(s % 60)}</b><i>seconds</i></span>
            </div>
          )}
          <div className="ps-sub">until polls close, 8 pm Tuesday, November 3</div>
          {banner && <div className="ps-banner">{banner}</div>}
          {sim && <div className="ps-label">{label}</div>}
        </div>
      )}

      {mode === "closed" && (
        <div className="ps-center">
          <div className="ps-closed-title ps-pop">Polls are closed</div>
          <div className="ps-sub">MN House 41B · Jen Fox for House</div>
        </div>
      )}

      <video ref={video} className={`ps-video${mode === "movie" && movieUrl ? " on" : ""}`} src={movieUrl || undefined} playsInline preload="auto"
        onEnded={() => setMode("tracker")} onError={() => { if (modeRef.current === "movie") setMode("tracker"); }}
        onLoadedMetadata={(e) => setMovieDur(e.currentTarget.duration)} />
      {mode === "movie" && !movieUrl && (
        <div className="ps-center">
          <div className="ps-kicker">Rehearsal</div>
          <div className="ps-closed-title">The movie plays here</div>
          <div className="ps-sub">Results in {placeholderLeft} s</div>
        </div>
      )}

      {mode === "tracker" && (
        <div className="ps-tracker">
          <div className="ps-top">
            <span className="ps-kicker">MN House 41B</span>
            {label && <span className="ps-label">{label}</span>}
            <span className="ps-count">{view.reportedCount} of {view.totalCount} precincts</span>
          </div>
          <div className="ps-hero">
            <div className="ps-cand ps-d">
              <div className="ps-name">{view.names.d}</div>
              <div className="ps-votes">{n(d)}</div>
              <div className="ps-share">{anyIn && d + r > 0 ? pct1(two(d, r)) : " "}</div>
            </div>
            <div className="ps-cand ps-r">
              <div className="ps-name">{view.names.r}</div>
              <div className="ps-votes">{n(r)}</div>
              <div className="ps-share">{anyIn && d + r > 0 ? pct1(two(r, d)) : " "}</div>
            </div>
          </div>
          <div className="ps-dots">
            {PLACES.map((place) => {
              const list = PRECINCTS.filter((x) => x.place === place);
              return (
                <div className="ps-group" key={place}>
                  <div className="ps-group-h">{place} <span>{list.filter((x) => repKeys.has(x.key)).length} of {list.length}</span></div>
                  <div className="ps-dotrow">
                    {list.map((x) => (
                      <div className={`ps-dot${repKeys.has(x.key) ? " on" : ""}`} key={x.key}><i /><span>{x.short}</span></div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="ps-pace">
            {card?.size === "corner" ? (
              <div className="ps-card ps-card-corner" key={card.id}>
                <div className="ps-card-kicker">{card.kicker}</div>
                <div className="ps-card-title">{card.title}</div>
                {card.lines.map((l, i) => <div className="ps-card-line" key={i}>{l}</div>)}
              </div>
            ) : allIn ? (
              <div className="ps-pace-read">All precincts reporting</div>
            ) : view.mode === "summary" && anyIn ? (
              <>
                <div className="ps-pace-read">{view.reportedCount} of {view.totalCount} precincts in</div>
                <div className="ps-pace-sub">The state has posted 41B totals but not precinct detail yet, so the pace read waits for it.</div>
              </>
            ) : p ? (
              <>
                <div className={`ps-pace-read ${p.read}`}>{p.read === "ahead" ? "Ahead of tie pace" : p.read === "on" ? "On tie pace" : "Behind tie pace"}</div>
                <div className="ps-pace-sub">
                  Margin so far: {signedMargin(p.margin, view.names.d, view.names.r)} · Tie pace in these precincts: {signedMargin(p.tieMargin, view.names.d, view.names.r)}
                </div>
                <div className="ps-est">estimate, 2024 baseline</div>
              </>
            ) : (
              <div className="ps-pace-read wait">Waiting for the first precinct</div>
            )}
          </div>
          <div className="ps-updated">
            {sim ? "Rehearsal script" : feed?.updated ? `State file updated ${ctTime(feed.updated)}` : feedErr ? "State file not reachable, retrying every minute" : ""}
          </div>
          {tickerItem && (
            <div className="ps-ticker" key={tick}><b>{tickerItem.label}</b><span>{tickerItem.text}</span></div>
          )}
        </div>
      )}

      {showWall && <PartyWall posts={posts} fresh={fresh} showNames={SHOW_NAMES} />}
      <PartyDogs run={dogRun} />

      {card && card.size === "full" && mode !== "movie" && (
        <div className={`ps-card ps-card-${card.size} ps-chime-${card.chime}`} key={card.id}>
          <div className="ps-card-kicker">{card.kicker}</div>
          <div className="ps-card-title">{card.title}</div>
          {card.lines.map((l, i) => <div className="ps-card-line" key={i}>{l}</div>)}
          {label && <div className="ps-label">{label}</div>}
        </div>
      )}

      {panel && (
        <div className="ps-panel">
          <div className="ps-panel-h">Setup{sim ? " · rehearsal" : ""}</div>
          <div className="ps-panel-btns">
            <label className="ps-btn">Load movie<input type="file" accept="video/*" onChange={(e) => loadMovie(e.target.files?.[0])} /></label>
            <button type="button" className="ps-btn" onClick={() => { setArmed(armAudio()); setTimeout(() => { setArmed(audioArmed()); chime("medium"); }, 60); }}>Arm audio</button>
            <button type="button" className="ps-btn" onClick={fullScreen}>Full screen</button>
            <button type="button" className="ps-btn go" onClick={() => setPanel(false)}>Go</button>
          </div>
          <ul className="ps-status">
            <li className={movieUrl ? "ok" : "warn"}>Movie: {movieUrl ? `${movieName}${movieDur ? `, ${mmss(movieDur)}` : ""}` : sim ? "not loaded (rehearsal shows a 12 s placeholder)" : "not loaded (the screen skips to results)"}</li>
            <li className={armed ? "ok" : "warn"}>Audio: {armed ? "armed" : "not armed, chimes will be silent"}</li>
            <li>Music: Spotify app. Pause it when the movie starts.</li>
            <li className={feed?.ok && !feedErr ? "ok" : "warn"}>Feed: {feed ? (feed.ok ? `${feed.mode === "precinct" ? "41B precinct file" : "41B district totals only"}, state file updated ${ctTime(feed.updated)}` : "no 41B file readable") : feedErr || "checking"}{feed && feed.errors.length ? ` · not read: ${feed.errors.map((e) => e.split(" ")[0]).join(", ")}` : ""}</li>
            <li className={postsStatus?.ok ? "ok" : "warn"}>Message wall: {wallOn ? "on" : "off"} · {postsStatus ? (postsStatus.ok ? `${realPosts.length} posts${sim ? ` + ${samplePosts.length} samples` : ""}, checked ${new Date(postsStatus.at).toLocaleTimeString("en-US", { timeZone: "America/Chicago" })}` : postsStatus.error) : "checking"}. W turns it on or off, D runs the dogs.</li>
            <li className={cmdStatus?.ok ? "ok" : "warn"}>Control table: {cmdStatus ? (cmdStatus.ok ? `reachable, checked ${new Date(cmdStatus.at).toLocaleTimeString("en-US", { timeZone: "America/Chicago" })}` : cmdStatus.error) : "checking"}</li>
            <li>State: {mode}. Keys: S hides this, F full screen, Space pauses movie, 1 countdown, 2 movie, 3 results.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
