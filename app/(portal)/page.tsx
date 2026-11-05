import { demoToday } from "@/lib/demo";
import Link from "next/link";
import { airtableConfigured } from "@/lib/airtable";
import { getSignsDetail, getSnapshots, type Snapshot } from "@/lib/data";
import { getBriefSummary } from "@/lib/brief";
import {
  BRIEF_LINKED, CALENDAR, COMING_UP, QUICK_LINKS, STALE_AFTER_DAYS,
  VAN_LISTS, VAN_LISTS_AS_OF,
} from "@/lib/config";
import { FIELD_BASELINE, RESULT } from "@/lib/static";
import { StatusBar, daysBetween, fmtDate, todayCT } from "@/components/ui";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-US");
const short = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function phaseLine(today: string): string {
  if (today < CALENDAR.absenteeStart) return `Absentee ballots go out ${fmtDate(CALENDAR.absenteeStart)}`;
  if (today < CALENDAR.earlyInPersonStart) return "Early voting is open: by mail, or in person at county election sites";
  if (today < CALENDAR.electionDay) return "Early voting is open, ballots go straight into the counter";
  if (today === CALENDAR.electionDay) return "Election Day";
  return "Election Day has passed";
}

function newestWith(rows: Snapshot[], keys: (keyof Snapshot)[]): Snapshot | null {
  return rows.find((r) => keys.every((k) => r[k] !== null && r[k] !== undefined)) || null;
}

export default async function Home() {
  const today = await demoToday();
  const toElection = daysBetween(today, CALENDAR.electionDay);
  const after = today > CALENDAR.electionDay;
  const total = RESULT.fox + RESULT.beck + RESULT.writeIn;
  const pct = (v: number) => `${((v / (RESULT.fox + RESULT.beck)) * 100).toFixed(1)}%`; // two-way share, same as the party screen
  const signed = (v: number) => (v > 0 ? `+${n(v)}` : v < 0 ? `−${n(-v)}` : "0");
  const brief = BRIEF_LINKED && after ? getBriefSummary() : null; // the brief is the post-election edition

  // A small numbers strip. The full charts live on /numbers.
  let strip: { label: string; value: string; asOf: string | null; source: string }[] = [];
  if (airtableConfigured()) {
    try {
      const [snapshots, signs] = await Promise.all([getSnapshots(), getSignsDetail()]);
      const ev = newestWith(snapshots, ["ballotsRequested", "alreadyVoted"]);
      const latest = snapshots[0] || null;
      const rowNewer = latest?.updatedDate ? latest.updatedDate > FIELD_BASELINE.through : false;
      const conv = rowNewer && latest
        ? { v: latest.conversations, d: latest.updatedDate }
        : { v: FIELD_BASELINE.conversations, d: FIELD_BASELINE.through };
      strip = [
        { label: after ? "Early ballots" : "Ballots cast", value: ev ? n(ev.alreadyVoted as number) : "Not entered", asOf: ev?.updatedDate || null, source: "Sample values" },
        { label: "Ballot applications", value: ev ? n(ev.ballotsRequested as number) : "Not entered", asOf: ev?.updatedDate || null, source: "Sample values" },
        { label: "Conversations this cycle", value: n(conv.v), asOf: conv.d, source: "Sample values" },
        { label: "Sign households delivered", value: `${n(signs.delivered)} · ${n(signs.open)} to go${signs.hold ? `, ${n(signs.hold)} on hold` : ""}`, asOf: today, source: "sign app, live" },
      ];
    } catch {
      strip = [];
    }
  }
  const isStale = (iso: string | null) => Boolean(iso) && daysBetween(iso as string, today) > STALE_AFTER_DAYS;
  const upcoming = COMING_UP.filter((c) => c.date >= today);
  const listsAge = daysBetween(VAN_LISTS_AS_OF, today);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Start here</h1>
          <div className="sub">Where to start: the brief, the lists, and the links the team uses every day.</div>
        </div>
      </div>

      <StatusBar
        items={after ? [
          `Jen won 41B by ${n(RESULT.fox - RESULT.beck)} votes`,
          <span className="hot" key="phase">{RESULT.official ? "Certified result" : `Unofficial · certified ${fmtDate(RESULT.certifiedOn)}`}</span>,
          `Election Day ${fmtDate(CALENDAR.electionDay)}`,
        ] : [
          toElection > 0 ? `${toElection} ${toElection === 1 ? "day" : "days"} to Election Day` : toElection === 0 ? "Election Day" : "After Election Day",
          <span className="hot" key="phase">{phaseLine(today)}</span>,
          `Election Day ${fmtDate(CALENDAR.electionDay)}`,
        ]}
      />

      {after && (
        <section className="card hub-result">
          <div className="card-head">
            <div>
              <div className="eyebrow">Result{RESULT.official ? "" : ", unofficial"}</div>
              <h2>Fox {n(RESULT.fox)} ({pct(RESULT.fox)}), Beck {n(RESULT.beck)} ({pct(RESULT.beck)})</h2>
            </div>
          </div>
          <p className="card-sub">
            2024 was {signed(RESULT.margin2024)}, so a {n(RESULT.fox - RESULT.beck - RESULT.margin2024)}-vote swing on {n(RESULT.votes2024 - total)} fewer ballots.
            Flipped {RESULT.flipped.join(", ")}. MN Secretary of State, as of {fmtDate(RESULT.asOf)}.
          </p>
          <div className="figs four">
            {RESULT.byPlace.map((p) => (
              <div key={p.place} className="fig">
                <div className="fig-label">{p.place}</div>
                <div className="fig-value">{signed(p.margin)}</div>
                <div className="meta">2024 {signed(p.margin2024)}</div>
              </div>
            ))}
            <div className="fig">
              <div className="fig-label">Ahead of the ticket</div>
              <div className="fig-value">{signed(RESULT.ticket[0].margin - RESULT.ticket[2].margin)}</div>
              <div className="meta">over Klobuchar's margin in 41B</div>
            </div>
          </div>
        </section>
      )}

      <div className="hub-top">
        {/* 1. The brief --------------------------------------------------------- */}
        {BRIEF_LINKED && (
          <section className="card hub-brief">
            <div className="eyebrow">State of the Race</div>
            <h2>{brief?.headline || "The weekly read on the race: field, early vote, turnout, money"}</h2>
            {brief && brief.points.length > 0 && (
              <ol className="brief-points">
                {brief.points.map((p) => <li key={p}>{p}</li>)}
              </ol>
            )}
            <div className="actions">
              <a className="btn" href="/brief" target="_blank" rel="noreferrer">Open the full brief</a>
              <Link className="btn ghost" href="/numbers">All the numbers</Link>
            </div>
          </section>
        )}

        {/* 2. Coming up --------------------------------------------------------- */}
        <section className="card hub-dates">
          <div className="eyebrow">Coming up</div>
          {upcoming.length ? (
            <ul className="dates">
              {upcoming.map((c) => (
                <li key={c.date}>
                  <span className="d">{short(c.date)}</span>
                  <span>{c.what}</span>
                </li>
              ))}
            </ul>
          ) : <div className="muted small">Nothing left on the calendar.</div>}
          <a className="small more" href={QUICK_LINKS.wixEvents} target="_blank" rel="noreferrer">Events on the website</a>
        </section>
      </div>

      {/* 3. VoteBuilder lists (hidden after Election Day) ------------------------ */}
      {!after && <section className="card hub-van">
        <div className="card-head">
          <div>
            <div className="eyebrow">VoteBuilder</div>
            <h2>Final-stretch lists</h2>
          </div>
          <div className="spacer" />
          <span className="pill">Sample counts</span>
        </div>
        <p className="card-sub">
          Saved searches the team worked from in the final stretch. In this demo the counts are sample values and the lists do not open. Counts are from {fmtDate(VAN_LISTS_AS_OF)}
          {listsAge > 0 ? ` (${listsAge} ${listsAge === 1 ? "day" : "days"} ago)` : ""} and fall as people vote; the list itself is always current.
        </p>
        <div className="van-lists">
          {VAN_LISTS.map((l, i) => (
            <div key={l.key} className={`van-list${l.urgent ? " urgent" : ""}`}>
              <div className="vl-top">
                <span className="vl-num">{i + 1}</span>
                <span className="vl-name">{l.name}</span>
                {l.urgent && <span className="pill warn">Do first</span>}
              </div>
              <div className="vl-what">{l.what}</div>
              <div className="vl-counts"><b>{n(l.people)}</b> people · <b>{n(l.doors)}</b> doors</div>
              <div className="vl-use">{l.useFor}</div>
              {l.order && <div className="vl-what"><b>Start with:</b> {l.order}</div>}
              <div className="vl-open">Opens in VoteBuilder (off in the demo)</div>
            </div>
          ))}
        </div>
      </section>}

      {/* 4. Numbers strip -------------------------------------------------------- */}
      {strip.length > 0 && (
        <section className="card hub-strip">
          <div className="card-head">
            <div className="eyebrow">Numbers</div>
            <div className="spacer" />
            <Link className="small" href="/numbers">Charts and sources &rarr;</Link>
          </div>
          <div className="figs four">
            {strip.map((s) => (
              <div key={s.label} className={`fig${isStale(s.asOf) ? " stale" : ""}`}>
                <div className="fig-label">{s.label}</div>
                <div className="fig-value">{s.value}</div>
                <div className="meta">
                  {s.asOf ? `As of ${fmtDate(s.asOf)}` : "Not entered yet"} · {s.source}
                  {isStale(s.asOf) && <span className="stale-tag">Out of date</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Campaign links ------------------------------------------------------- */}
      <section className="card hub-links">
        <div className="eyebrow">Links</div>
        <div className="link-grid">
          <a href={QUICK_LINKS.wixSite} target="_blank" rel="noreferrer"><b>Campaign website</b><span>jenfoxforhouse.com</span></a>
          <a href={QUICK_LINKS.wixEvents} target="_blank" rel="noreferrer"><b>Events page</b><span>Knocks and public events</span></a>
          <a href={QUICK_LINKS.signAppOrg} target="_blank" rel="noreferrer"><b>Sign routes</b><span>Yard sign app, organizer view</span></a>
          <a href={QUICK_LINKS.signAppSignup} target="_blank" rel="noreferrer"><b>Sign request form</b><span>Public signup</span></a>
          <a href={QUICK_LINKS.cfbConverter}><b>CFB converter</b><span>Oath or Democracy Engine export to CFB import</span></a>
          <Link href="/party"><b>Party screen</b><span>Election night results wall</span></Link>
        </div>
      </section>
    </>
  );
}
