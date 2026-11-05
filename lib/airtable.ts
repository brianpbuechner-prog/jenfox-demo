// Portfolio demo: every read comes from lib/fixtures.json, built by scripts/make_fixtures.py.
// Nothing here talks to Airtable, and writes are accepted and discarded.
import fixtures from "./fixtures.json";

export type Fields = Record<string, unknown>;
export interface Rec<T extends Fields = Fields> {
  id: string;
  createdTime: string;
  fields: T;
}

const DATA = fixtures as unknown as Record<string, Rec[]>;

export function airtableConfigured(): boolean {
  return true;
}

interface ListOpts {
  filterByFormula?: string;
  sort?: { field: string; direction?: "asc" | "desc" }[];
  fields?: string[];
  maxRecords?: number;
  revalidate?: number;
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export async function listAll<T extends Fields = Fields>(_baseId: string, tableId: string, opts: ListOpts = {}): Promise<Rec<T>[]> {
  let rows = [...(DATA[tableId] || [])] as Rec<T>[];
  for (const s of [...(opts.sort || [])].reverse()) {
    const dir = s.direction === "desc" ? -1 : 1;
    rows.sort((a, b) => dir * cmp(a.fields[s.field], b.fields[s.field]));
  }
  if (opts.maxRecords) rows = rows.slice(0, opts.maxRecords);
  return rows;
}

export async function getRecord<T extends Fields = Fields>(_baseId: string, tableId: string, id: string): Promise<Rec<T> | null> {
  return ((DATA[tableId] || []).find((r) => r.id === id) as Rec<T>) || null;
}

export async function updateRecord(): Promise<void> {}
export async function createRecord(): Promise<string> {
  return "recDEMO";
}

export const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
export const num = (v: unknown): number => (typeof v === "number" ? v : 0);
export const bool = (v: unknown): boolean => v === true;
export const sel = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "name" in v) return String((v as { name: unknown }).name);
  return "";
};
