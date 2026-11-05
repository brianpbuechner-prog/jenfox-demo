// Election night, 3 Nov 2026. Reads the Minnesota Secretary of State's live results files
// (plain semicolon-delimited text, one row per candidate per precinct) on the server and
// sets each 41B precinct against its own 2022 and 2024 results. Public data only.
//
// File format (same since 2022): state;county;precinct;office id;office name;district;
// candidate order;name;suffix;incumbent;party;precincts reporting;precincts total;votes;
// percent;total votes in the race in this unit.
//
// Before polls close the state posts TEST numbers in these same files. The page says so
// until 8 pm Central on 3 Nov (which is CST: 02:00 UTC on 4 Nov).

export const SOS_BASE = "https://electionresultsfiles.sos.mn.gov/20261103/";
export const POLLS_CLOSE_UTC = Date.parse("2026-11-04T02:00:00Z");

export type Bench = {
  county: string; code: string; name: string; place: "Hastings" | "Cottage Grove" | "Townships";
  fox24: number; dippel24: number; house24: number;
  dfl22: number; r22: number; house22: number;
  walz22: number; jensen22: number;
};

// Certified 2022 and 2024 results for the 15 41B precincts, from the SOS precinct files
// (20221108 and 20241105 sthousepct.txt, 20221108 governorpct.txt), checked 26 Oct 2026:
// they sum to Fox 12,019 / Dippel 12,529 (2024), Folch 9,365 / Hudella 9,783 and
// governor's race DFL 9,631 / R 9,054 (2022). Same precinct codes in both years.
export const BENCH: Bench[] = [
  { county: "19", code: "2610", name: "Hastings W-1 P-1", place: "Hastings", fox24: 784, dippel24: 749, house24: 1538, dfl22: 551, r22: 559, house22: 1111, walz22: 573, jensen22: 502 },
  { county: "19", code: "2620", name: "Hastings W-1 P-2", place: "Hastings", fox24: 689, dippel24: 916, house24: 1609, dfl22: 518, r22: 718, house22: 1237, walz22: 526, jensen22: 653 },
  { county: "19", code: "2630", name: "Hastings W-2 P-2", place: "Hastings", fox24: 715, dippel24: 709, house24: 1427, dfl22: 511, r22: 561, house22: 1073, walz22: 544, jensen22: 515 },
  { county: "19", code: "2640", name: "Hastings W-2 P-3", place: "Hastings", fox24: 806, dippel24: 822, house24: 1630, dfl22: 624, r22: 626, house22: 1250, walz22: 634, jensen22: 564 },
  { county: "19", code: "2650", name: "Hastings W-3 P-1", place: "Hastings", fox24: 804, dippel24: 875, house24: 1682, dfl22: 647, r22: 718, house22: 1367, walz22: 676, jensen22: 664 },
  { county: "19", code: "2660", name: "Hastings W-3 P-2", place: "Hastings", fox24: 773, dippel24: 821, house24: 1598, dfl22: 614, r22: 666, house22: 1280, walz22: 626, jensen22: 608 },
  { county: "19", code: "2670", name: "Hastings W-4 P-1", place: "Hastings", fox24: 890, dippel24: 1081, house24: 1974, dfl22: 709, r22: 967, house22: 1679, walz22: 772, jensen22: 872 },
  { county: "19", code: "2680", name: "Hastings W-4 P-2", place: "Hastings", fox24: 872, dippel24: 942, house24: 1817, dfl22: 612, r22: 723, house22: 1335, walz22: 637, jensen22: 669 },
  { county: "19", code: "3710", name: "Nininger Twp", place: "Townships", fox24: 211, dippel24: 353, house24: 564, dfl22: 184, r22: 322, house22: 506, walz22: 192, jensen22: 305 },
  { county: "82", code: "0050", name: "Cottage Grove P-3", place: "Cottage Grove", fox24: 1119, dippel24: 936, house24: 2058, dfl22: 849, r22: 643, house22: 1494, walz22: 872, jensen22: 611 },
  { county: "82", code: "0055", name: "Cottage Grove P-4", place: "Cottage Grove", fox24: 1418, dippel24: 1313, house24: 2739, dfl22: 1178, r22: 954, house22: 2133, walz22: 1164, jensen22: 895 },
  { county: "82", code: "0060", name: "Cottage Grove P-5", place: "Cottage Grove", fox24: 1854, dippel24: 1775, house24: 3631, dfl22: 1492, r22: 1331, house22: 2828, walz22: 1515, jensen22: 1254 },
  { county: "82", code: "0070", name: "Cottage Grove P-7", place: "Cottage Grove", fox24: 676, dippel24: 682, house24: 1367, dfl22: 548, r22: 530, house22: 1079, walz22: 559, jensen22: 498 },
  { county: "82", code: "0100", name: "Denmark Twp P-1", place: "Townships", fox24: 407, dippel24: 555, house24: 963, dfl22: 327, r22: 465, house22: 792, walz22: 340, jensen22: 444 },
  { county: "82", code: "0140", name: "Hastings W-2 P-1", place: "Hastings", fox24: 1, dippel24: 0, house24: 1, dfl22: 1, r22: 0, house22: 1, walz22: 1, jensen22: 0 },
];

export const key = (county: string, code: string) => `${county}-${code}`;
const BENCH_KEYS = new Set(BENCH.map((b) => key(b.county, b.code)));

/** Fox's two-way share in 2024 was 48.96%; a uniform +1.04 points flips the seat on 2024 lines. */
export const SHARE24 = 12019 / (12019 + 12529);
export const FLIP_SWING = 0.5 - SHARE24;

export type Race = "house" | "gov" | "sen" | "cd2" | "sd41";
const FILES: Record<Race, string> = {
  house: "sthousepct.txt",
  gov: "governorpct.txt",
  sen: "ussenatepct.txt",
  cd2: "ushousepct.txt",
  sd41: "StateSenateByPct.txt",
};
// Office filter for files that hold more than one district.
const DISTRICT: Partial<Record<Race, string>> = { house: "41B", cd2: "2", sd41: "41" };

export type Cand = { name: string; party: string; votes: number };
export type PrecinctResult = { reported: boolean; cands: Cand[]; total: number };
export type RaceResult = {
  ok: boolean; error?: string; updated?: string | null;
  byPrecinct: Map<string, PrecinctResult>;
};

async function fetchRace(race: Race): Promise<RaceResult> {
  const byPrecinct = new Map<string, PrecinctResult>();
  try {
    // no-store: some of these files run past the 2 MB data-cache limit, and the numbers move every few minutes.
    const res = await fetch(SOS_BASE + FILES[race], { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `The state's file returned ${res.status}`, byPrecinct };
    const text = await res.text();
    for (const line of text.split(/\r?\n/)) {
      const p = line.split(";");
      if (p.length < 16) continue;
      const k = key(p[1], p[2]);
      if (!BENCH_KEYS.has(k)) continue;
      const want = DISTRICT[race];
      if (want && p[5] !== want) continue;
      const pr = byPrecinct.get(k) || { reported: false, cands: [], total: 0 };
      pr.reported = pr.reported || Number(p[11]) > 0;
      pr.total = Number(p[15]) || 0;
      pr.cands.push({ name: p[7], party: p[10], votes: Number(p[13]) || 0 });
      byPrecinct.set(k, pr);
    }
    return { ok: true, updated: res.headers.get("last-modified"), byPrecinct };
  } catch (e) {
    return { ok: false, error: "Could not reach the state's results site", byPrecinct };
  }
}

export async function getElectionNight() {
  const races = ["house", "gov", "sen", "cd2", "sd41"] as Race[];
  const results = await Promise.all(races.map(fetchRace));
  return Object.fromEntries(races.map((r, i) => [r, results[i]])) as Record<Race, RaceResult>;
}

/** DFL and Republican votes in one precinct of one race. */
export function dr(pr: PrecinctResult | undefined) {
  if (!pr) return { d: 0, r: 0, dName: "", rName: "" };
  const d = pr.cands.find((c) => c.party === "DFL");
  const r = pr.cands.find((c) => c.party === "R");
  return { d: d?.votes || 0, r: r?.votes || 0, dName: d?.name || "", rName: r?.name || "" };
}
