// Treasurer deadlines for /deadlines. Added 2026-10-21.
//
// Sources, both read 21 Oct 2026:
//  - CFB "Legislative and Constitutional Office Candidate Handbook", last revised 4/30/2026
//    https://cfb.mn.gov/pdf/publications/handbooks/candidate_handbook.pdf
//  - CFB "2026 Disclosure Calendar for Candidates for Senate, House, and District Courts"
//    https://cfb.mn.gov/pdf/calendars/2026_senate_house_district_court.pdf
// Page numbers below are the handbook's own page numbers.
//
// Nothing here holds donor data. A started deadline stores a kind, two dates and a short note.

export const DEADLINES_TABLE = "tblYdUaJ5bsHKjjbB";
export const DF = {
  name: "fldiS7qtstqOXP1oR",
  kind: "fldMdcrsb9qx6M1Kw",
  started: "fldrsMalBCWE0f9jV",
  due: "fldMbTKUjqbn6szPD",
  status: "fldHMc3UP9fXgirXd",
  doneOn: "fldbOgFMsGsnlA4hN",
  key: "fldtF8tuZGAhpLU8D",
  note: "fld5yNAMYHEZbW8AX",
} as const;

export const CFB = {
  cfro: "https://logon.cfb.mn.gov/sso/",
  notice: "https://notice.cfb.mn.gov/reporting/",
  calendar: "https://cfb.mn.gov/pdf/calendars/2026_senate_house_district_court.pdf",
  handbook: "https://cfb.mn.gov/pdf/publications/handbooks/candidate_handbook.pdf",
  registration: "https://cfb.mn.gov/filer-resources/complete-a-filing/campaign-finance-filings/registration/",
  reportForms: "https://cfb.mn.gov/filer-resources/complete-a-filing/campaign-finance-filings/campaign-finance-report/",
  contact: "https://cfb.mn.gov/contact-us/",
  phone: "651-539-1180",
  reportingPhone: "651-539-1188",
  converter: "/treasurer#convert",
} as const;

export interface DeadlineLink { label: string; href: string }

// ---------------------------------------------------------------------------
// Fixed deadlines. Dates from the 2026 calendar for House candidates.
// A "window" is open from `opens` through `due`; the others are a single due date.
// ---------------------------------------------------------------------------
export interface FixedDeadline {
  key: string;
  title: string;
  due: string;
  opens?: string;
  /** Where the clock ring starts filling. Defaults to `opens`, else 30 days before `due`. */
  countFrom?: string;
  what: string;
  late?: string;
  links: DeadlineLink[];
}

export const FIXED_DEADLINES: FixedDeadline[] = [
  {
    key: "lcn-general-2026",
    title: "Large contribution notice window",
    opens: "2026-10-20",
    due: "2026-11-02",
    what: "Any one source totaling more than $500 received in this window needs a notice by the end of the next business day. Start a deadline below for each one so its clock shows here.",
    late: "$50 a day per late notice, up to $1,000.",
    links: [
      { label: "File a notice", href: CFB.notice },
      { label: "CFRO", href: CFB.cfro },
    ],
  },
  {
    key: "pre-general-2026",
    title: "Pre-general report",
    due: "2026-10-26",
    countFrom: "2026-10-19",
    what: "Covers 1 Jan through 19 Oct 2026. Run the latest Oath and Democracy Engine exports through the converter on this page, import them in CFRO, then file.",
    late: "$50 a day starting 27 Oct, up to $1,000.",
    links: [
      { label: "CFRO", href: CFB.cfro },
      { label: "CFB converter", href: CFB.converter },
      { label: "2026 calendar", href: CFB.calendar },
    ],
  },
  {
    key: "year-end-checks-2026",
    title: "Year-end money checks",
    due: "2026-12-31",
    countFrom: "2026-11-03",
    what: "Public subsidy agreements expire 31 Dec. Campaign expenditures for the cycle must at least equal the public subsidy received, or the difference goes back to the Board. Cash carried into the next cycle is capped at 25% of the base spending limit ($21,050 for House).",
    links: [
      { label: "Handbook, After the election", href: CFB.handbook + "#page=51" },
      { label: "CFRO", href: CFB.cfro },
    ],
  },
  {
    key: "year-end-2026",
    title: "2026 year-end report",
    due: "2027-02-01",
    countFrom: "2026-12-31",
    what: "Covers 1 Jan through 31 Dec 2026.",
    late: "$25 a day starting 2 Feb, up to $1,000.",
    links: [
      { label: "CFRO", href: CFB.cfro },
      { label: "2026 calendar", href: CFB.calendar },
    ],
  },
];

// ---------------------------------------------------------------------------
// Rolling deadlines Jackie starts from a date.
// `business` counts business days (weekends and the holidays below skipped);
// otherwise calendar days.
// ---------------------------------------------------------------------------
export type RollingKind = "Deposit" | "Large contribution notice" | "Return" | "Anonymous" | "Amend" | "Registration change";

export interface RollingRule {
  kind: RollingKind;
  label: string;
  startLabel: string;
  days: number;
  business: boolean;
  rule: string;
  page: number;
  link?: DeadlineLink;
}

export const ROLLING: RollingRule[] = [
  {
    kind: "Large contribution notice", label: "File a large contribution notice", startLabel: "Date received",
    days: 1, business: true, page: 38,
    rule: "More than $500 from one source between 20 Oct and 2 Nov: notice due by the end of the next business day.",
    link: { label: "File a notice", href: CFB.notice },
  },
  {
    kind: "Deposit", label: "Deposit contributions", startLabel: "Date received",
    days: 10, business: true, page: 14,
    rule: "Deposit within 10 business days. Online gifts count as received when the funds are available.",
  },
  {
    kind: "Return", label: "Return an over-limit or prohibited contribution", startLabel: "Date deposited",
    days: 90, business: false, page: 20,
    rule: "Returned within 90 days of deposit, it stays off the report and the violation is cleared. A single check over the limit is refunded at deposit instead.",
  },
  {
    kind: "Anonymous", label: "Send an anonymous contribution to the Board", startLabel: "Date received",
    days: 14, business: false, page: 17,
    rule: "Anonymous gifts over $20 go to the Board in full within 14 days.",
    link: { label: "Board contact", href: CFB.contact },
  },
  {
    kind: "Amend", label: "Amend a filed report", startLabel: "Date the mistake was found",
    days: 10, business: false, page: 43,
    rule: "File the amended report within 10 days. Call the Board if you need more time.",
    link: { label: "CFRO", href: CFB.cfro },
  },
  {
    kind: "Registration change", label: "Report a registration change", startLabel: "Date of the change",
    days: 10, business: false, page: 8,
    rule: "Tell the Board in writing within 10 days of a change to anything on the registration form.",
    link: { label: "Registration form", href: CFB.registration },
  },
];

export const rollingRule = (kind: string) => ROLLING.find((r) => r.kind === kind);

// Minnesota state holidays the business-day count skips. Assumed list for Oct 2026
// through Feb 2027; check with the Board if a deadline lands next to one.
export const STATE_HOLIDAYS = [
  "2026-11-11", // Veterans Day
  "2026-11-26", // Thanksgiving
  "2026-11-27", // Day after Thanksgiving
  "2026-12-25", // Christmas
  "2027-01-01", // New Year's Day
  "2027-01-18", // Martin Luther King Jr. Day
  "2027-02-15", // Presidents' Day
];

// Large contribution notice windows from the 2026 calendar.
export const LCN_WINDOWS = [
  { from: "2026-07-21", to: "2026-08-10" },
  { from: "2026-10-20", to: "2026-11-02" },
];
export const inLcnWindow = (iso: string) => LCN_WINDOWS.some((w) => iso >= w.from && iso <= w.to);

// --- date math on YYYY-MM-DD strings (noon UTC anchors, no DST edges) -------
const toDate = (iso: string) => new Date(iso + "T12:00:00Z");
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(iso: string, n: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

export function isBusinessDay(iso: string): boolean {
  const dow = toDate(iso).getUTCDay();
  return dow !== 0 && dow !== 6 && !STATE_HOLIDAYS.includes(iso);
}

export function addBusinessDays(iso: string, n: number): string {
  let cur = iso;
  let left = n;
  while (left > 0) {
    cur = addDays(cur, 1);
    if (isBusinessDay(cur)) left--;
  }
  return cur;
}

export function dueFor(rule: RollingRule, startIso: string): string {
  return rule.business ? addBusinessDays(startIso, rule.days) : addDays(startIso, rule.days);
}

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(toDate(s).getTime());

// ---------------------------------------------------------------------------
// Added 2026-10-21, second pass: money totals, limits, after-election checklist, mileage.
// ---------------------------------------------------------------------------

/** Committee totals Jackie enters after each filing. Totals only, never donors. */
export const MONEY_TABLE = "tblBWpDTx9YWJ6qFf";
export const MF = {
  label: "fld33WHwjDV1tR3k5",
  asOf: "fldCdKjU7Dr5l6SMm",
  cash: "fldC6CLA0TZa4rW1B",
  raised: "fld7wXyKVi80cw3St",
  campaignSpending: "fldaRWwwKIgi5wgNV",
  subsidy: "fldC9ZuqWkL59k05q",
  specialSources: "fld65Sp3FEVtOWjij",
  partyUnits: "fldhrPfL5YtbQgEXX",
  notes: "fldYKRRSG5Rxoh0UL",
} as const;

/** 2025-2026 House figures from the candidate handbook. */
export const LIMITS = {
  individual: 1000,
  noticeOver: 500,
  itemizeOver: 200,
  spending: 84200,
  spendingFirstTime: 92620,
  specialSources: 16800,
  partyUnits: 10000,
  carryForward: 21050,
} as const;

/** CFB 2026 mileage memo: reimburse at the 2026 IRS rate. */
export const MILEAGE = {
  rate: 0.725,
  memo: "https://cfb.mn.gov/pdf/publications/general/2026_mileage_memo.pdf",
} as const;

/** After Election Day. Checked off the same way as the fixed deadlines (a Fixed row per key). */
export const CHECKLIST: { key: string; title: string; detail: string }[] = [
  {
    key: "post-thanks-2026",
    title: "Thank-you notes and post-election ads",
    detail: "Holiday cards, thank-you notes and news ads after the general election, sent before the cycle ends, are noncampaign disbursements.",
  },
  {
    key: "post-party-2026",
    title: "Election night or post-election party",
    detail: "Its costs are a noncampaign disbursement once Jen's name is no longer on a ballot.",
  },
  {
    key: "post-subsidy-2026",
    title: "Compare campaign spending to the public subsidy",
    detail: "Campaign expenditures must at least equal the subsidy received. Set aside any difference; the Board says after the year-end report if any goes back.",
  },
  {
    key: "post-carry-2026",
    title: "Check cash against the carry-forward limit",
    detail: "Cash and property over $21,050 on 31 Dec has to come down first (campaign spending, noncampaign disbursements, party contributions) or goes to the state elections campaign fund.",
  },
  {
    key: "post-records-2026",
    title: "Keep the records",
    detail: "Four years from the date each report is filed, and four years after the committee closes.",
  },
  {
    key: "post-close-2026",
    title: "Only if the committee is closing",
    detail: "Bring cash and property to $100 or less, then file a termination report. Debts can stay; the committee cannot give assets away for personal use.",
  },
];
