// Figures that have no live source on this site. Each block carries its own as-of
// date and source so Home can print both and grey the block out when it ages.
// Aggregate counts only. Change a block by replacing its numbers AND its date.

// ---------------------------------------------------------------------------
// Field, September 2026 by week. VAN Canvass Results, committee Fox - HD41B,
// Group By Legislative, 41B row. Read 1 Oct 2026 (HD41B_StateOfRace_Update_Notes_2026-10-01.md, 2d).
// "All" is every contact type; "door" is contact type Walk only.
// ---------------------------------------------------------------------------
export const FIELD_WEEKS = {
  asOf: "2026-10-01",
  source: "Sample values, not VoteBuilder data",
  weeks: [
    { label: "Aug 31", range: "Aug 31 to Sep 6", attempts: 1300, conversations: 300, doorAttempts: 1000, doorConversations: 280 },
    { label: "Sep 7", range: "Sep 7 to 13", attempts: 2000, conversations: 420, doorAttempts: 1700, doorConversations: 400 },
    { label: "Sep 14", range: "Sep 14 to 20", attempts: 2400, conversations: 540, doorAttempts: 1900, doorConversations: 520 },
    { label: "Sep 21", range: "Sep 21 to 27", attempts: 3200, conversations: 850, doorAttempts: 3100, doorConversations: 840 },
    { label: "Sep 28", range: "Sep 28 to 30, 3 days", attempts: 1500, conversations: 450, doorAttempts: 1500, doorConversations: 450 },
  ],
} as const;

// Sample cycle totals through 30 Sep, the baseline the October weekly bars count from.
export const FIELD_BASELINE = {
  through: "2026-09-30",
  attempts: 30000,
  conversations: 6500,
  doorAttempts: 26000,
  doorConversations: 6200,
} as const;

// ---------------------------------------------------------------------------
// Signs per 1,000 target voters. Recomputed 26 Oct from the sign app base (delivered households
// with coordinates) mapped onto the SOS precinct polygons of 18 Sep 2026 (first run 30 Sep); the denominator is Low Propensity Democrats plus High
// Propensity Persuasion from the 17 Aug VAN segment counts. The State of the Race doc
// lists this among its estimates.
// ---------------------------------------------------------------------------
export const SIGNS_PER_1000 = {
  asOf: "2026-10-26",
  source: "Sign app households per 1,000 target voters; the target counts are sample values",
  rows: [
    { label: "Cottage Grove", value: 75.0, signs: 150, targets: 2000 },
    { label: "Hastings and townships", value: 172.7, signs: 380, targets: 2200 },
    { label: "District", value: 126.2, signs: 530, targets: 4200 },
  ],
  cgSharePolygon: 28.3,
} as const;

// ---------------------------------------------------------------------------
// Website sessions per day, 1 Aug to 1 Nov 2026. Wix Analytics API, captured 30 Sep and
// extended 5, 13, 21, 26, 27, 30, 31 Oct, 1 and 2 Nov (Wix_Daily_Sessions_2026-08-01_to_11-01.csv; Sep 30 re-read as 104). Wix keeps only 62 days, so this is
// the only copy of August. Later weeks come from the Web Snapshot table.
// ---------------------------------------------------------------------------
export const WIX_DAILY = {
  start: "2026-08-01",
  source: "Wix Analytics, captured Sep 30, extended Nov 2",
  sessions: [
    13, 10, 19, 25, 25, 29, 25, 13, 27, 34, 52, 67, 25, 19, 10, 19, 15, 20, 28, 41, 22, 13, 14, 7, 23, 26, 24, 15, 13, 25, 54,
    30, 32, 15, 15, 21, 26, 18, 36, 32, 28, 25, 18, 17, 27, 30, 69, 67, 66, 54, 54, 70, 108, 84, 78, 85, 87, 95, 94, 54, 104, 79, 51, 49, 37,
    74, 48, 40, 31, 53, 32, 39, 30, 38, 66, 40, 29, 31, 38, 51, 55, 79, 77, 47, 43, 50, 54, 54, 48, 55, 58, 56, 52,
  ],
  marks: [{ date: "2026-09-16", label: "Paid ads start" }],
} as const;

// ---------------------------------------------------------------------------
// Last five sends to the 41B Weekly list. Wix email campaign statistics, read about 11:20 AM CT 2 Nov.
// The 30 Oct "Jen in the news" send was about 3 days old when read. The 2 Nov election night
// invitation went to 23 addresses, not the list, so it is not shown here.
// The 20, 28 and 30 Oct sends are not numbered issues; 18 Oct is Issue 8 and 26 Oct is Issue 9.
// ---------------------------------------------------------------------------
export const EMAIL_SENDS = {
  asOf: "2026-11-02",
  source: "Wix email statistics, read Nov 2",
  sends: [
    { date: "2026-10-30", subject: "Jen in the news: the voter guide and two interviews", delivered: 128, opened: 75, clicked: 8 },
    { date: "2026-10-28", subject: "Walk with Jen in the Monster Bash Parade", delivered: 128, opened: 62, clicked: 1 },
    { date: "2026-10-26", subject: "Come knock with us", delivered: 127, opened: 58, clicked: 3 },
    { date: "2026-10-20", subject: "Jen in the news", delivered: 128, opened: 81, clicked: 8 },
    { date: "2026-10-18", subject: "Tell one neighbor why", delivered: 128, opened: 76, clicked: 2 },
  ],
} as const;

// ---------------------------------------------------------------------------
// Money. Campaign Finance Board 2026 pre-general reports, 1 Jan to 19 Oct 2026, read from the
// report PDFs on 27 Oct (Fox committee 19059 original, received 26 Oct; Beck 19245 amendment 2,
// received 23 Oct; both to the cent). Beck's raised and spent include $41,295 of HRCC in-kind
// TV and cable, which HRCC reports as approved expenditures for him.
// IE totals are the spenders' own pre-general reports, schedule B3A, for the twelve committees
// active in 41B (DFL House Caucus, HRCC, Planned Parenthood MN PAF, Together Minnesota,
// MN Family Prosperity Project, Renew Minnesota, Advance Minnesota and others), read 27 Oct.
// HRCC files its anti-Fox lines under an old Fox committee id (15594), so the by-candidate
// viewer under 19059 shows none of them; "nothing against Fox" in earlier versions was wrong.
// Spenders not re-read on 27 Oct (DFL State Central, MN AFL-CIO, AFSCME) are left out, so
// "for Fox" is a floor. No further full reports before Election Day; the year-end report is due 1 Feb 2027.
// ---------------------------------------------------------------------------
export const MONEY = {
  reportThrough: "2026-10-19",
  reportRead: "2026-10-27",
  nextReportDue: "2027-02-01",
  source: "Campaign Finance Board",
  candidates: [
    { name: "Fox", party: "DFL", raised: 125558.71, spent: 78424.95, cash: 80214.23 },
    { name: "Beck", party: "GOP", raised: 81682.76, spent: 73162.3, cash: 15156.8 },
  ],
  spendingLimitFox: 84200,
  spendingLimitBeck: 92620,
  // Campaign expenditures incl. in-kind (report line 13): the part that counts toward the limit
  // (Minn. Stat. 10A.25). Excludes noncampaign disbursements and contributions to party units.
  campaignSpentFox: 69637.86,
  // 2025 campaign expenditures (2025 year-end report), same two-year segment, so they count too.
  campaignSpentFox2025: 31.25,
  campaignSpentBeck: 72664.98,
  ie: {
    fileRead: "2026-10-27",
    newestRow: "2026-10-19",
    rows: [
      { name: "Fox", forAmt: 43231.96, againstAmt: 61135.2 },
      { name: "Beck", forAmt: 7921.74, againstAmt: 224372.32 },
    ],
    againstFoxNote: "HRCC $58,735 (11 mailers, radio, digital) and Renew Minnesota $2,400",
  },
} as const;

// --- 2026 general election result, unofficial. Added 5 Nov 2026 ---
// Source: MN SOS precinct files electionresultsfiles.sos.mn.gov/20261103/ (last updated 11/04/26 10:48 AM).
// Unofficial until the State Canvassing Board meets 19 Nov 2026. Update these figures from the certified files then.
export const RESULT = {
  asOf: "2026-11-04",
  certifiedOn: "2026-11-19",
  official: false,
  fox: 11363,
  beck: 9656,
  writeIn: 33,
  margin2024: -510, // Dippel 12,529, Fox 12,019
  votes2024: 24598,
  byPlace: [
    { place: "Cottage Grove", margin: 1376, margin2024: 361 },
    { place: "Hastings", margin: 513, margin2024: -581 },
    { place: "Denmark and Nininger", margin: -182, margin2024: -290 },
  ],
  // DFL margin in the same 15 precincts, for comparison.
  ticket: [
    { race: "Jen Fox, House 41B", margin: 1707 },
    { race: "US House, Little", margin: 1306 },
    { race: "Governor, Klobuchar", margin: 1284 },
    { race: "State Senate 41, Seeberger", margin: 553 },
    { race: "US Senate, Flanagan", margin: 319 },
  ],
  flipped: ["Cottage Grove P-7", "Hastings W-2 P-3", "Hastings W-3 P-1", "Hastings W-3 P-2", "Hastings W-4 P-2"],
} as const;
