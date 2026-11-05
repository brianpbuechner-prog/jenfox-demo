import { AIRTABLE_BASE_ID, ELECTION, F, SIGNS, SIGNS_DETAIL, T, WEB } from "./config";
import { bool, listAll, getRecord, num, sel, str, type Rec } from "./airtable";
import { DEADLINES_TABLE, DF, MF, MONEY_TABLE } from "./deadlines";

export interface Idea {
  id: string; title: string; pitch: string; raisedBy: string; status: string; effort: string; target: string;
  discussion: string; created: string;
}
export interface Task {
  id: string; title: string; owner: string; due: string; status: string; category: string; notes: string;
}
export interface Issue {
  id: string; issue: string; sentDate: string; recipients: number; status: string; link: string; notes: string;
}
export interface Invoice {
  id: string; number: string; date: string; amount: number; status: string; description: string; link: string;
}
export interface Snapshot {
  id: string; label: string; canvassAttempts: number; conversations: number; updatedBy: string; updatedDate: string; notes: string;
  /** Nov 3 general. Null when the row predates these fields or they were left blank. */
  ballotsRequested: number | null; alreadyVoted: number | null;
  /** Added 2026-10-01. Null = not entered on that row. */
  doorAttempts: number | null; doorConversations: number | null;
  appsCG: number | null; votedCG: number | null; appsWash: number | null; votedWash: number | null;
  idStrongJen: number | null; idLeanJen: number | null; idUndecided: number | null;
  idLeanGOP: number | null; idStrongGOP: number | null; idNotVoting: number | null;
  undecidedCG: number | null; l2Returned: number | null; l2Returned65: number | null;
}

const d = F.idea, k = F.task, i = F.issue, v = F.invoice, sn = F.snapshot;

export const toIdea = (r: Rec): Idea => ({
  id: r.id, title: str(r.fields[d.title]), pitch: str(r.fields[d.pitch]), raisedBy: sel(r.fields[d.raisedBy]),
  status: sel(r.fields[d.status]), effort: str(r.fields[d.effort]), target: str(r.fields[d.target]),
  discussion: str(r.fields[d.discussion]), created: r.createdTime,
});
export const toTask = (r: Rec): Task => ({
  id: r.id, title: str(r.fields[k.title]), owner: sel(r.fields[k.owner]), due: str(r.fields[k.due]),
  status: sel(r.fields[k.status]), category: sel(r.fields[k.category]), notes: str(r.fields[k.notes]),
});
export const toIssue = (r: Rec): Issue => ({
  id: r.id, issue: str(r.fields[i.issue]), sentDate: str(r.fields[i.sentDate]), recipients: num(r.fields[i.recipients]),
  status: sel(r.fields[i.status]), link: str(r.fields[i.link]), notes: str(r.fields[i.notes]),
});
export const toInvoice = (r: Rec): Invoice => ({
  id: r.id, number: str(r.fields[v.number]), date: str(r.fields[v.date]), amount: num(r.fields[v.amount]),
  status: sel(r.fields[v.status]), description: str(r.fields[v.description]), link: str(r.fields[v.link]),
});
const opt = (r: Rec, f: string): number | null => (typeof r.fields[f] === "number" ? (r.fields[f] as number) : null);

export const toSnapshot = (r: Rec): Snapshot => ({
  id: r.id, label: str(r.fields[sn.label]), canvassAttempts: num(r.fields[sn.canvassAttempts]),
  conversations: num(r.fields[sn.conversations]), updatedBy: sel(r.fields[sn.updatedBy]),
  updatedDate: str(r.fields[sn.updatedDate]), notes: str(r.fields[sn.notes]),
  ballotsRequested: r.fields[sn.ballotsRequested] == null ? null : num(r.fields[sn.ballotsRequested]),
  alreadyVoted: r.fields[sn.alreadyVoted] == null ? null : num(r.fields[sn.alreadyVoted]),
  doorAttempts: opt(r, sn.doorAttempts), doorConversations: opt(r, sn.doorConversations),
  appsCG: opt(r, sn.appsCG), votedCG: opt(r, sn.votedCG), appsWash: opt(r, sn.appsWash), votedWash: opt(r, sn.votedWash),
  idStrongJen: opt(r, sn.idStrongJen), idLeanJen: opt(r, sn.idLeanJen), idUndecided: opt(r, sn.idUndecided),
  idLeanGOP: opt(r, sn.idLeanGOP), idStrongGOP: opt(r, sn.idStrongGOP), idNotVoting: opt(r, sn.idNotVoting),
  undecidedCG: opt(r, sn.undecidedCG), l2Returned: opt(r, sn.l2Returned), l2Returned65: opt(r, sn.l2Returned65),
});

export const getIdeas = async () => (await listAll(AIRTABLE_BASE_ID, T.ideas)).map(toIdea);
export const getIdea = async (id: string) => { const r = await getRecord(AIRTABLE_BASE_ID, T.ideas, id); return r ? toIdea(r) : null; };
export const getTasks = async () => (await listAll(AIRTABLE_BASE_ID, T.tasks, { sort: [{ field: k.due, direction: "asc" }] })).map(toTask);
export const getIssues = async () => (await listAll(AIRTABLE_BASE_ID, T.newsletter, { sort: [{ field: i.sentDate, direction: "desc" }] })).map(toIssue);
export const getInvoices = async () => (await listAll(AIRTABLE_BASE_ID, T.invoices, { sort: [{ field: v.date, direction: "desc" }] })).map(toInvoice);
export const getSnapshots = async () => (await listAll(AIRTABLE_BASE_ID, T.snapshot, { sort: [{ field: sn.updatedDate, direction: "desc" }] })).map(toSnapshot);
export const getLatestSnapshot = async () => { const rows = await getSnapshots(); return rows[0] || null; };

// Cross-base, read-only. Aggregate counts only, no addresses or names, no voter file data.
export interface SignsSummary { delivered: number; total: number; }
export async function getSignsSummary(): Promise<SignsSummary> {
  const rows = await listAll(SIGNS.baseId, SIGNS.table, { fields: [SIGNS.statusField] });
  const statuses = rows.map((r) => sel(r.fields[SIGNS.statusField]));
  const delivered = statuses.filter((s) => s === SIGNS.deliveredValue).length;
  // "No sign" and "Declined" mean the household opted out, so they are not requests. Exclude both from the denominator.
  const total = statuses.filter((s) => s !== SIGNS.noSignValue && s !== SIGNS.declinedValue).length;
  return { delivered, total };
}

export interface ElectionSummary { fox2024: number; dippel2024: number; margin2024: number; }
export async function getElectionSummary(): Promise<ElectionSummary> {
  const rows = await listAll(ELECTION.baseId, ELECTION.table, { fields: [ELECTION.foxField, ELECTION.dippelField] });
  let fox = 0, dippel = 0;
  for (const r of rows) { fox += num(r.fields[ELECTION.foxField]); dippel += num(r.fields[ELECTION.dippelField]); }
  return { fox2024: fox, dippel2024: dippel, margin2024: dippel - fox };
}

export const boolField = bool;

// ---------------------------------------------------------------------------
// Added 2026-09-18 for the Home rebuild. All cross-base reads are aggregate
// counts and route names only. No addresses, no names, no voter file data.
// ---------------------------------------------------------------------------

export interface SignsDetail {
  delivered: number; total: number; open: number; hold: number; needsDecision: number;
  /** Delivered signs whose mailing city is Cottage Grove. Mailing city, not precinct. */
  deliveredCG: number;
}

/** Delivered, the request denominator, still-open stops, and rows the app has flagged. */
export async function getSignsDetail(): Promise<SignsDetail> {
  const rows = await listAll(SIGNS.baseId, SIGNS.table, {
    fields: [SIGNS.statusField, SIGNS_DETAIL.needsDecision, SIGNS_DETAIL.cityField],
  });
  let delivered = 0, total = 0, open = 0, hold = 0, needsDecision = 0, deliveredCG = 0;
  for (const r of rows) {
    const s = sel(r.fields[SIGNS.statusField]);
    if (s === SIGNS.deliveredValue) {
      delivered++;
      if (sel(r.fields[SIGNS_DETAIL.cityField]) === SIGNS_DETAIL.cgCity) deliveredCG++;
    }
    // "No sign" and "Declined" mean the household opted out, so they are not requests.
    if (s !== SIGNS.noSignValue && s !== SIGNS.declinedValue) total++;
    if (s === SIGNS_DETAIL.openStatus) open++;
    if (s === SIGNS.holdValue) hold++;
    if (sel(r.fields[SIGNS_DETAIL.needsDecision])) needsDecision++;
  }
  return { delivered, total, open, hold, needsDecision, deliveredCG };
}

export interface RouteRow { name: string; area: string; volunteer: string; stops: number; }

/** Open routes only. Archived and Complete routes are not work anyone still has to do. */
export async function getOpenRoutes(): Promise<RouteRow[]> {
  const rows = await listAll(SIGNS.baseId, SIGNS_DETAIL.routesTable, {
    fields: [
      SIGNS_DETAIL.routeName, SIGNS_DETAIL.routeArea, SIGNS_DETAIL.routeVolunteer,
      SIGNS_DETAIL.routeStatus, SIGNS_DETAIL.routeSigns,
    ],
  });
  return rows
    .filter((r) => sel(r.fields[SIGNS_DETAIL.routeStatus]) === SIGNS_DETAIL.routeOpen)
    .map((r) => {
      const linked = r.fields[SIGNS_DETAIL.routeSigns];
      return {
        name: str(r.fields[SIGNS_DETAIL.routeName]),
        area: str(r.fields[SIGNS_DETAIL.routeArea]),
        volunteer: str(r.fields[SIGNS_DETAIL.routeVolunteer]),
        stops: Array.isArray(linked) ? linked.length : 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

export interface Web {
  date: string; sessions7: number; visitors7: number; forms7: number;
  sessions30: number; visitors30: number; forms30: number;
}

export async function getWebSnapshots(): Promise<Web[]> {
  const rows = await listAll(AIRTABLE_BASE_ID, WEB.table, {
    sort: [{ field: WEB.date, direction: "desc" }],
  });
  return rows.map((r) => ({
    date: str(r.fields[WEB.date]),
    sessions7: num(r.fields[WEB.sessions7]),
    visitors7: num(r.fields[WEB.visitors7]),
    forms7: num(r.fields[WEB.forms7]),
    sessions30: num(r.fields[WEB.sessions30]),
    visitors30: num(r.fields[WEB.visitors30]),
    forms30: num(r.fields[WEB.forms30]),
  }));
}

export const getLatestWeb = async (): Promise<Web | null> => (await getWebSnapshots())[0] || null;

// --- Added 2026-10-21: treasurer deadlines (/treasurer) ---

export interface DeadlineRow {
  id: string; name: string; kind: string; started: string; due: string; status: string; doneOn: string; key: string; note: string;
}

export async function getDeadlineRows(): Promise<DeadlineRow[]> {
  const rows = await listAll(AIRTABLE_BASE_ID, DEADLINES_TABLE, { revalidate: 30 });
  return rows.map((r) => ({
    id: r.id, name: str(r.fields[DF.name]), kind: sel(r.fields[DF.kind]), started: str(r.fields[DF.started]),
    due: str(r.fields[DF.due]), status: sel(r.fields[DF.status]) || "Open", doneOn: str(r.fields[DF.doneOn]),
    key: str(r.fields[DF.key]), note: str(r.fields[DF.note]),
  }));
}

// --- Added 2026-10-21: committee totals for /treasurer ---

export interface MoneyRow {
  id: string; label: string; asOf: string; notes: string;
  cash: number | null; raised: number | null; campaignSpending: number | null;
  subsidy: number | null; specialSources: number | null; partyUnits: number | null;
}

export async function getMoneyRows(): Promise<MoneyRow[]> {
  const rows = await listAll(AIRTABLE_BASE_ID, MONEY_TABLE, { sort: [{ field: MF.asOf, direction: "desc" }], revalidate: 60 });
  const n = (r: Rec, f: string) => (typeof r.fields[f] === "number" ? (r.fields[f] as number) : null);
  return rows.map((r) => ({
    id: r.id, label: str(r.fields[MF.label]), asOf: str(r.fields[MF.asOf]), notes: str(r.fields[MF.notes]),
    cash: n(r, MF.cash), raised: n(r, MF.raised), campaignSpending: n(r, MF.campaignSpending),
    subsidy: n(r, MF.subsidy), specialSources: n(r, MF.specialSources), partyUnits: n(r, MF.partyUnits),
  }));
}
