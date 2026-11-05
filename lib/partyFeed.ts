// Election night party screen (/party): the shape of the results feed and the math the
// screen does on it. No server-only imports, so the screen and the rehearsal script use it too.
import { BENCH, FLIP_SWING, key } from "@/lib/electionNight";

export type FeedPrecinct = { key: string; reported: boolean; d: number; r: number };
export type TickerItem = { label: string; text: string };

export type Feed = {
  ok: boolean;
  /** precinct: the 41B precinct file was read. summary: only the district total file was. */
  mode: "precinct" | "summary" | "none";
  updated: string | null;
  fetchedAt: string;
  names: { d: string; r: string };
  totals: { d: number; r: number };
  reportedCount: number;
  totalCount: number;
  precincts: FeedPrecinct[];
  ticker: TickerItem[];
  errors: string[];
};

export const PLACES = ["Hastings", "Cottage Grove", "Townships"] as const;

export const PRECINCTS = BENCH.map((b) => ({
  key: key(b.county, b.code),
  name: b.name,
  place: b.place,
  short: b.code === "0140" ? "W-2 P-1 Wash."
    : b.name.replace(/^Hastings /, "").replace(/^Cottage Grove /, "").replace(/ Twp( P-1)?$/, ""),
  s24: b.fox24 + b.dippel24 > 0 ? b.fox24 / (b.fox24 + b.dippel24) : 0.5,
  bench: b,
}));
export const PRECINCT_BY_KEY = new Map(PRECINCTS.map((p) => [p.key, p]));

export type Pace = {
  share: number; tie: number; diff: number;
  read: "ahead" | "on" | "behind";
  margin: number; tieMargin: number;
};

/** Fox's two-way share in the precincts in, against the share that ties the seat on 2024 lines
 *  (each precinct's 2024 Fox share plus the uniform FLIP_SWING), weighted by votes cast. Estimate. */
export function pace(precincts: FeedPrecinct[]): Pace | null {
  let d = 0, v = 0, tgt = 0;
  for (const p of precincts) {
    if (!p.reported) continue;
    const meta = PRECINCT_BY_KEY.get(p.key);
    const tw = p.d + p.r;
    if (!meta || tw <= 0) continue;
    d += p.d; v += tw; tgt += tw * Math.min(1, meta.s24 + FLIP_SWING);
  }
  if (v <= 0) return null;
  const share = d / v, tie = tgt / v, diff = share - tie;
  return {
    share, tie, diff,
    read: Math.abs(diff) < 0.005 ? "on" : diff > 0 ? "ahead" : "behind",
    margin: Math.round(2 * d - v),
    tieMargin: Math.round(2 * tgt - v),
  };
}

export const n = (v: number) => v.toLocaleString("en-US");
export const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
export const two = (d: number, r: number) => (d + r > 0 ? d / (d + r) : 0);
export const lastName = (s: string) => s.trim().split(/\s+/).slice(-1)[0] || s;
export const signedMargin = (m: number, dName: string, rName: string) =>
  m === 0 ? "Tied" : `${lastName(m > 0 ? dName : rName)} +${n(Math.abs(m))}`;
