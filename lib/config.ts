// Table and field IDs for the Jen Fox Team Site base.
// IDs are stable even if someone renames a field in Airtable.

export const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appZKFUz9CcVJRWXM";

export const T = {
  ideas: "tblnDmOlehtIR85w1",
  tasks: "tbl3WFideiZxmt7i0",
  newsletter: "tblSpH5A5Z1lVKM0J",
  invoices: "tbl5up3C7Qv60g9Bt",
  snapshot: "tblzo7POZrIqJNBEt",
} as const;

export const F = {
  idea: {
    title: "fldBGLRdQlx0yHQRi",
    pitch: "fld6fEQAQvQvv8eQB",
    raisedBy: "fldUlxCs8D3iUcrQV",
    status: "fldSfWmUeumQnLbno",
    effort: "fldRlmwlndkynaqPh",
    target: "fldtNofVZ5wpmOdVy",
    discussion: "fld1Cy1eAdooxjSGB",
  },
  task: {
    title: "fldqM8qt9ShxvHmL0",
    owner: "fldgxbUIV3uc36uXK",
    due: "fldCatBPXl5X1CcEM",
    status: "fldpdxEYd4AE6nJVC",
    category: "fldEgxuEqs76U1WpO",
    notes: "fldqGNY6L0Dzzvg0I",
  },
  issue: {
    issue: "fldzNa7eCSE1cHypq",
    sentDate: "fldcZx45S3TzEkkxA",
    recipients: "fldIQfFlCzBiMVWt5",
    status: "fldIPYOhBQFFJQSdx",
    link: "fldU3hmSPlyzEX9ly",
    notes: "fldWeLPbNCJl3rIVq",
  },
  invoice: {
    number: "fldyaSsgpJuNAadVm",
    date: "fldvwS7Fi8mR2SWI8",
    amount: "fldGdUKG1S2iZykNu",
    status: "fld54UAklE0fIa4OO",
    description: "fldGKs3ClH1FwnjDQ",
    link: "fldKEOOYWk1eO7AOm",
  },
  snapshot: {
    label: "fldHNrpTKFBZDPLtd",
    canvassAttempts: "fldBn8hGh4b4jZhi7",
    conversations: "fld2ZYGxq5wdV0i5G",
    updatedBy: "fldDnXZbEPYnzYUwQ",
    updatedDate: "fldroyJLKheRg29YP",
    notes: "fldbsmK8CfMSr2niM",
    // Added 2026-09-25. Nov 3 general, from VAN Early Voter Status. Aggregate counts only.
    ballotsRequested: "fldgkpKiEHvPb7axe",
    alreadyVoted: "fld727dzj1qFAJoR2",
    // Added 2026-10-01 for the Home dashboard. All optional; blank means "not read that week".
    doorAttempts: "fldg6tCMqWxi3eX0x",
    doorConversations: "fldrDmuqPDCwECEp3",
    appsCG: "fldzcA0d68h2cLhcs",
    votedCG: "fld9NOX8EWE0eKURI",
    appsWash: "fldIh3l6QNbyGRK7p",
    votedWash: "fldkk8F7Duf7IQRnY",
    idStrongJen: "fldcgUuPoBMWJx1W5",
    idLeanJen: "fldnSwJKQOAqnNXJI",
    idUndecided: "fld1xkq6r1ikZnFpz",
    idLeanGOP: "fldzXqdDOv2CQrZSs",
    idStrongGOP: "fldGbiI1uckhznr4t",
    idNotVoting: "fldFEQeEk4EXn4r0O",
    undecidedCG: "fldRXeQuVVuS6t5iJ",
    l2Returned: "fldcPYHDPpodymesH",
    l2Returned65: "fldcDwx9P5EI7rjVo",
  },
} as const;

// Read-only cross-base sources for the Data snapshot page.
// The same AIRTABLE_TOKEN needs read access to these two bases as well.
export const SIGNS = {
  baseId: process.env.SIGNS_BASE_ID || "applCUAwqNAa2bS1G",
  table: "tbl7iKg1Nnb6mh4Nf",
  statusField: "fldBOtwXYDDQXd3BY",
  deliveredValue: "Delivered",
  noSignValue: "No sign",
  // Declined means the household turned the sign down, so like "No sign" it is not an open request.
  declinedValue: "Declined",
  holdValue: "Hold",
} as const;

export const ELECTION = {
  baseId: process.env.ELECTION_BASE_ID || "appfkSgq4iQ9Xb3ed",
  table: "tblMVsRE8a6WSkm6j",
  foxField: "fldzJuxHtxNNxxGKL",
  dippelField: "fldyO3KETCnLI0q9o",
} as const;

export const CHOICES = {
  raisedBy: ["Brian", "Jen"],
  ideaStatus: ["Idea", "Proposed", "Agreed", "In progress", "Done", "Declined"],
  taskOwner: ["Brian", "Jen", "Treasurer"],
  taskStatus: ["Not started", "In progress", "Done"],
  taskCategory: ["General", "Newsletter", "Signs", "Data", "Compliance"],
  issueStatus: ["Draft", "Scheduled", "Sent"],
  invoiceStatus: ["Sent", "Paid"],
  snapshotUpdatedBy: ["Brian", "Jen", "Treasurer"],
};

// Quick links on Home. Update freely, these are not Airtable-backed.
export const QUICK_LINKS = {
  wixSite: "https://www.jenfoxforhouse.com/",
  wixEvents: "https://www.jenfoxforhouse.com/events-1",
  vanLogin: "#van-sample",
  signAppOrg: "/signs/org.html",
  signAppSignup: "/signs/signup.html",
  cfbConverter: "/treasurer#convert",
} as const;

export const AIRTABLE_INTERFACE_URL = `https://airtable.com/${AIRTABLE_BASE_ID}`;

// ---------------------------------------------------------------------------
// Added 2026-09-18 for the Home rebuild.
// ---------------------------------------------------------------------------

// Election calendar. These three dates are verified against the Minnesota
// Secretary of State and are the same copy that runs on the public /vote page.
// Do not reword them here without changing them there too.
// absenteeStart is also the day in-person ABSENTEE voting opened at the county
// offices (Dakota: 1590 Hwy 55, Hastings; Washington: Cottage Grove Service
// Center, 13000 Ravine Pkwy S). earlyInPersonStart is Minnesota's new "direct"
// early voting, where the ballot goes straight into the counter.
export const CALENDAR = {
  absenteeStart: "2026-09-18",
  earlyInPersonStart: "2026-10-16",
  electionDay: "2026-11-03",
} as const;

// Weekly jenfoxforhouse.com traffic, captured from the Wix Analytics API.
// Wix only retains 62 days, so these rows are the only long-term record.
export const WEB = {
  table: "tblUGpWxubHH53nlo",
  label: "fldQSr5H3PeOUsvAH",
  date: "fld9ZTK14CwTTgCo6",
  sessions7: "fldngmIyXp2kHjJjC",
  visitors7: "fldpgoVGBcA3gTMRM",
  forms7: "fldKfnw5aAcS988PS",
  sessions30: "fldS8FItofRgOWE4T",
  visitors30: "fldNOem9NaMJiONzT",
  forms30: "flddf8X3oOfvCWhbR",
  notes: "fldWkSOU2VNC6dA9M",
} as const;

// Sign app, read-only. Extra fields behind the "Needs a person" block on Home.
export const SIGNS_DETAIL = {
  needsDecision: "fld4q42GDZ1po1Kc6",
  // Mailing city, a single select. Not the precinct: some "Hastings" addresses sit in Nininger or Denmark.
  cityField: "fld7tymdLUFk32WYv",
  cgCity: "Cottage Grove",
  openStatus: "Needs delivery",
  routesTable: "tblT2v41v90hrpr6c",
  routeName: "fldtVGStm5NhLbCsd",
  routeArea: "fldkmLU4pDeoMbxf5",
  routeVolunteer: "fld5vnXsUHE66CbIN",
  routeStatus: "fldjzAOMjaHW6feCD",
  routeSigns: "fldQrM2qDcIQ01Nyj",
  routeOpen: "Open",
} as const;

// A hand-entered figure older than this many days is shown as stale, not current.
export const STALE_AFTER_DAYS = 10;

// The State of the Race visual brief at /brief. The route exists either way and sits
// behind the access code. Set to true once Brian has looked at it, and the Home link
// row starts showing it.
export const BRIEF_LINKED = true;

// The one-line race read at the top of "Where the race stands". An estimate from the State of the
// Race review, not a poll; the reasoning lives in the doc. Change the words AND the date together.
export const RACE_READ = {
  asOf: "2026-10-26",
  text: "Toss-up leaning Fox (estimate from the State of the Race review). No 41B poll exists.",
  docUrl: "/brief",
} as const;

// ---------------------------------------------------------------------------
// Added 2026-10-19: VoteBuilder links on Home.
// Links only. Nothing from VAN is read or stored here, and the counts below are
// aggregate totals copied from VAN on the date in `countsAsOf`. Each list is a saved
// search, so its live count falls as people vote; the link always opens the current one.
// Source: the "41B Voter Lists for the Final Stretch" deck, built 18 Oct 2026. Counts re-run 21 Oct
// in Create A List with each saved search's own criteria (Preview only, My List untouched). Re-run 26 Oct
// as previews rebuilt from each list's description; a saved search may differ slightly. Re-run 28 Oct to 2 Nov the same way. Cure was not re-read on 2 Nov (15 is the 1 Nov count).
// ---------------------------------------------------------------------------
export const VAN_LISTS_AS_OF = "2026-11-02";

// Portfolio demo: the list names and purposes are the real ones; every count is a sample value
// and no link opens VoteBuilder.
export const VAN_LISTS: {
  key: string; name: string; vanName: string; what: string; useFor: string; order?: string;
  people: number; doors: number; url: string; urgent?: boolean;
}[] = [
  { key: "cure", name: "Cure", urgent: true, vanName: "Cure",
    what: "Mail ballot rejected and no other vote yet. It does not count unless they fix it or vote another way.",
    useFor: "Calls first", people: 20, doors: 20, url: "#van-sample" },
  { key: "chase-jen", name: "Chase: Jen supporters", vanName: "Chase: supporters",
    what: "Requested a mail ballot, not returned, and identified as a Jen supporter. The surest ballots on the Chase list.",
    useFor: "Chase these first", people: 80, doors: 70, url: "#van-sample" },
  { key: "chase", name: "Chase", vanName: "Chase",
    what: "Requested a mail ballot, not returned and no early vote.",
    useFor: "Getting ballots returned, doors or phones", people: 300, doors: 280, url: "#van-sample" },
  { key: "gotv", name: "GOTV", vanName: "GOTV",
    what: "Identified Jen supporters who have not voted early.",
    useFor: "Final weekend and Nov 3", people: 2500, doors: 2000, url: "#van-sample" },
  { key: "undecided", name: "Undecided", vanName: "Undecided",
    what: "Identified as undecided, and not voted early.",
    useFor: "Last persuasion contacts", people: 1000, doors: 900, url: "#van-sample" },
];

// Dates on Home. Verified copies only; keep in step with CALENDAR above.
export const COMING_UP: { date: string; what: string }[] = [
  { date: "2026-10-25", what: "41B Weekly, next Sunday send (Issue 8 went out 18 Oct)" },
  { date: "2026-10-26", what: "CFB pre-general report due" },
  { date: "2026-11-01", what: "GOTV door knock" },
  { date: "2026-11-02", what: "Last day of early voting" },
  { date: "2026-11-03", what: "Election Day" },
  { date: "2026-11-04", what: "Yard sign pickup" },
];
