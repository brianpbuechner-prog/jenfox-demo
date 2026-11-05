// CFB receipts import builder, added 2026-10-21.
// Turns an Oath or a Democracy Engine contribution export into the CSV that
// CFRO reads at Maintenance -> Import -> Receipts. Pure functions only: the
// converter on /treasurer runs these in the browser, so donor data never
// reaches the server. Same rules as CFB_Import/oath_to_cfb.py and de_to_cfb.py.

export type Source = "oath" | "democracy-engine";

export interface Receipt {
  ReceiptDate: string; ReceiptAmount: string; ReceiptType: string; EntityType: string;
  LastName: string; FirstName: string; Address1: string; Address2: string;
  City: string; State: string; Zip: string; Employment: string;
}

export interface Conversion {
  source: Source;
  receipts: Receipt[];
  gross: number;
  fees: number;
  warnings: string[];
  skipped: number;
  /** Dates the money became available (Oath payout_available_on, DE payment posted on), ISO, with receipt counts. */
  fundsDates: { date: string; receipts: number }[];
  /** Receipts whose export has no available/posted date yet (DE leaves "Transmittal Payment Posted On" blank until it pays). */
  undated: number;
}

export const HEADER: (keyof Receipt)[] = [
  "ReceiptDate", "ReceiptAmount", "ReceiptType", "EntityType", "LastName", "FirstName",
  "Address1", "Address2", "City", "State", "Zip", "Employment",
];

export const SOURCE_LABEL: Record<Source, string> = { oath: "Oath", "democracy-engine": "Democracy Engine" };

// Employer answers that say nothing; occupation is used instead.
const USELESS_EMPLOYER = new Set(["", "self", "self employed", "self-employed", "selfemployed", "no", "none",
  "n/a", "na", "n/", "-", "s et of"]);
const NO_EMPLOYMENT = new Set(["", "no employer", "n/a", "na", "n/", "none", "-"]);

export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** "20261022", "2026-09-08 00:55:05.000" or "9/8/2026" -> "2026-10-22"; "" if unreadable. */
function iso(raw: string): string {
  raw = String(raw || "").trim();
  let m = raw.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "";
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const norm = (s: string | undefined) => String(s || "").replace(/\s+/g, " ").trim();

function employment(employer: string, occupation: string): string {
  const emp = norm(employer), occ = norm(occupation);
  return USELESS_EMPLOYER.has(emp.toLowerCase()) ? occ || emp : emp;
}

/** "2026-10-12 19:33:05 -0500", "2026-09-03 20:35:05.000" or "9/3/2026" -> "10/12/2026" */
function mdy(raw: string): string {
  raw = norm(raw);
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
  return "";
}

export function detectSource(header: string[]): Source | null {
  const h = new Set(header.map(key));
  if (h.has("grossamount") && h.has("donorlastname")) return "democracy-engine";
  if (h.has("donationamount") && h.has("donorlastname")) return "oath";
  return null;
}

export function convert(text: string, year: number): Conversion | { error: string } {
  const matrix = parseCSV(text);
  if (matrix.length < 2) return { error: "The file has no rows." };
  const source = detectSource(matrix[0]);
  if (!source) {
    return { error: "This does not look like an Oath or Democracy Engine export. Use the CSV straight from either one, not a copy saved from Excel or Sheets." };
  }
  const head = matrix[0].map(key);
  const de = source === "democracy-engine";
  const receipts: Receipt[] = [];
  const warnings: string[] = [];
  let gross = 0, fees = 0, skipped = 0;
  const funds = new Map<string, number>();
  let undated = 0;

  matrix.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const r: Record<string, string> = {};
    head.forEach((h, i) => { r[h] = cells[i] ?? ""; });
    const g = (k: string) => norm(r[k]);

    const first = g("donorfirstname");
    const last = g("donorlastname");
    const who = `${first} ${last}`.trim() || "No name";

    const kind = (de ? g("actiontypecall") : g("reportingcategory")).toLowerCase();
    if (kind && kind !== "charge") {
      warnings.push(`Line ${line}: ${who} left out, the row is a ${kind}, not a charge. Refunds are entered by hand.`);
      skipped++; return;
    }
    if (de && g("donorisanorganizationnotanindividual").toLowerCase() === "yes") {
      warnings.push(`Line ${line}: ${who} left out, the donor is an organization. Enter it by hand with the right entity type.`);
      skipped++; return;
    }
    if (de && g("isthiscontributionearmarked").toLowerCase() === "yes") {
      const via = g("fecconduitcommitteenameifapplicable");
      warnings.push(`Line ${line}: ${who} is marked earmarked${via ? ` through ${via}` : ""}. Check intermediary reporting before filing.`);
    }

    const amount = parseFloat((de ? g("grossamount") : g("donationamount")).replace(/[$,]/g, ""));
    const date = mdy(de ? g("donationdatect") || g("donationdateet") : g("transactiondate"));
    if (!(amount > 0) || !date) {
      warnings.push(`Line ${line}: ${who} left out, no usable amount or date.`);
      skipped++; return;
    }
    fees += parseFloat((de ? g("conveniencefeeifapplicable") : g("processingfee")).replace(/[$,]/g, "")) || 0;

    const address1 = de ? g("donoraddr1") : g("address");
    const zip = de ? g("donorzip") : g("zipcode");
    const emp = de ? employment(g("donoremployer"), g("donoroccupation")) : employment(g("employer"), g("occupation"));

    if (Number(date.slice(6)) !== year) warnings.push(`Line ${line}: ${who} is dated ${date}. CFRO only imports receipts from the current year.`);
    if (!address1) warnings.push(`Line ${line}: ${who} has no street address.`);
    if (/^\d{4}$/.test(zip)) warnings.push(`Line ${line}: ${who} zip is ${zip}, which looks like a lost leading zero (0${zip}?). Was the file opened in Excel?`);
    else if (!/^\d{5}(-\d{4})?$/.test(zip)) warnings.push(`Line ${line}: ${who} zip looks wrong: "${zip}".`);
    if (amount > 200 && NO_EMPLOYMENT.has(emp.toLowerCase())) {
      warnings.push(`Line ${line}: ${who} gave $${amount.toFixed(2)} with no employer or occupation. Over $200 the CFB wants one.`);
    }

    const available = iso(de ? g("transmittalpaymentpostedon") : g("payoutavailableon"));
    if (available) funds.set(available, (funds.get(available) || 0) + 1);
    else undated++;

    gross += amount;
    receipts.push({
      ReceiptDate: date,
      ReceiptAmount: amount.toFixed(2),
      ReceiptType: "Contribution",
      EntityType: "Ind",
      LastName: last,
      FirstName: first,
      Address1: address1,
      Address2: de ? g("donoraddr2") : "",
      City: de ? g("donorcity") : g("city"),
      State: (de ? g("donorstate") : g("state")).toUpperCase().slice(0, 2),
      Zip: zip,
      Employment: emp,
    });
  });

  const fundsDates = Array.from(funds, ([date, n]) => ({ date, receipts: n })).sort((a, b) => a.date.localeCompare(b.date));
  return { source, receipts, gross, fees, warnings, skipped, fundsDates, undated };
}

const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCSV(receipts: Receipt[]): string {
  return [HEADER.join(","), ...receipts.map((r) => HEADER.map((h) => cell(r[h])).join(","))].join("\r\n") + "\r\n";
}
