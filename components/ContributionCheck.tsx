"use client";
// Contribution check on /treasurer, added 2026-10-21.
// Reads Oath and Democracy Engine CSV exports in this browser only (Democracy Engine added 2026-10-21). Nothing is uploaded, sent or saved:
// the file never leaves the page, and closing the tab clears it. That is what lets donor
// names appear here while the site itself stores none.
import { useState } from "react";
import { LCN_WINDOWS, LIMITS, addBusinessDays } from "@/lib/deadlines";

interface Gift { donor: string; name: string; date: string; amount: number; employer: string; occupation: string }
interface NoticeHit { name: string; window: string; crossed: string; due: string; total: number; later: number }
interface LimitHit { name: string; total: number }
interface EmployerHit { name: string; total: number; reads: string }

const NO_ANSWER = ["", "self", "self employed", "self-employed", "selfemployed", "no", "none", "n/a", "na", "-", "s et of", "no employer"];

function parseCSV(text: string): string[][] {
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

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const norm = (s: string) => String(s || "").replace(/\s+/g, " ").trim();

function pick(row: Record<string, string>, names: string[]): string {
  for (const n of names) { const v = row[key(n)]; if (v !== undefined && v.trim() !== "") return v.trim(); }
  return "";
}

function isoDate(raw: string): string {
  raw = norm(raw);
  let m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "";
}

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function readGifts(text: string): { gifts: Gift[]; raw: string[] } {
  const matrix = parseCSV(text);
  if (!matrix.length) return { gifts: [], raw: [] };
  const head = matrix[0].map((h) => key(h));
  const gifts: Gift[] = [];
  const raw: string[] = [];
  for (const cells of matrix.slice(1)) {
    const r: Record<string, string> = {};
    head.forEach((h, i) => { r[h] = cells[i] ?? ""; });
    const cat = pick(r, ["reporting_category", "action_type_call", "category", "type"]).toLowerCase();
    if (cat && cat !== "charge" && cat !== "contribution") continue;
    const amount = parseFloat(pick(r, ["donation_amount", "gross_amount", "receiptamount", "amount", "gross"]).replace(/[$,]/g, ""));
    const rawDate = pick(r, ["transaction_date", "donation_date_ct", "receiptdate", "date", "created"]);
    const date = isoDate(rawDate);
    if (!date || !(amount > 0)) continue;
    const first = norm(pick(r, ["donor_first_name", "firstname", "first"]));
    const last = norm(pick(r, ["donor_last_name", "lastname", "last"]));
    const zip = norm(pick(r, ["zip_code", "donor_zip", "zip", "postal_code"])).slice(0, 5);
    raw.push([first, last, zip, rawDate, amount].join("|").toLowerCase());
    gifts.push({
      donor: key(first + last) + zip,
      name: `${first} ${last}`.trim() || "No name",
      date, amount,
      employer: norm(pick(r, ["employer", "donor_employer", "employment"])),
      occupation: norm(pick(r, ["occupation", "donor_occupation", "job"])),
    });
  }
  return { gifts, raw };
}

export default function ContributionCheck() {
  const [files, setFiles] = useState<string[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");

  async function load(list: FileList | null) {
    if (!list || !list.length) return;
    setError("");
    const seen = new Set<string>();
    const all: Gift[] = [];
    const names: string[] = [];
    for (const f of Array.from(list)) {
      if (!/\.csv$/i.test(f.name)) { setError(`${f.name} is not a CSV. Use the CSV straight from Oath or Democracy Engine.`); continue; }
      const { gifts: g, raw } = readGifts(await f.text());
      g.forEach((gift, i) => { if (!seen.has(raw[i])) { seen.add(raw[i]); all.push(gift); } });
      names.push(f.name);
    }
    setFiles(names);
    setGifts(all);
  }

  function clear() { setFiles([]); setGifts([]); setError(""); }

  // --- checks ---------------------------------------------------------------
  const byDonor = new Map<string, Gift[]>();
  for (const g of gifts) byDonor.set(g.donor, [...(byDonor.get(g.donor) || []), g]);

  const notices: NoticeHit[] = [];
  const limits: LimitHit[] = [];
  const employers: EmployerHit[] = [];
  for (const list of Array.from(byDonor.values())) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const name = sorted[0].name;
    for (const w of LCN_WINDOWS) {
      const inWin = sorted.filter((g) => g.date >= w.from && g.date <= w.to);
      let run = 0, crossed = "", later = 0;
      for (const g of inWin) {
        if (crossed) { later++; continue; }
        run += g.amount;
        if (run > LIMITS.noticeOver) crossed = g.date;
      }
      if (crossed) {
        const total = inWin.reduce((s, g) => s + g.amount, 0);
        notices.push({ name, window: w.from, crossed, due: addBusinessDays(crossed, 1), total, later });
      }
    }
    const cycle = sorted.filter((g) => g.date >= "2025-01-01" && g.date <= "2026-12-31").reduce((s, g) => s + g.amount, 0);
    if (cycle >= LIMITS.individual * 0.8) limits.push({ name, total: cycle });
    const year = sorted.filter((g) => g.date.startsWith("2026"));
    const yearTotal = year.reduce((s, g) => s + g.amount, 0);
    if (yearTotal > LIMITS.itemizeOver) {
      const latest = year[year.length - 1];
      const empOk = !NO_ANSWER.includes(latest.employer.toLowerCase());
      const occOk = !NO_ANSWER.includes(latest.occupation.toLowerCase());
      if (!empOk && !occOk) employers.push({ name, total: yearTotal, reads: latest.employer || latest.occupation || "blank" });
    }
  }
  notices.sort((a, b) => a.due.localeCompare(b.due));
  limits.sort((a, b) => b.total - a.total);

  const today = todayCT();
  const dates = gifts.map((g) => g.date).sort();
  const loaded = gifts.length > 0;

  return (
    <div className="cc">
      <label
        className={`cc-drop${dragOver ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); load(e.dataTransfer.files); }}
      >
        <input type="file" accept=".csv,text/csv" multiple onChange={(e) => load(e.target.files)} />
        <b>{loaded ? `${files.length} ${files.length === 1 ? "file" : "files"} read: ${gifts.length} gifts, ${day(dates[0])} to ${day(dates[dates.length - 1])}` : "Drop Oath or Democracy Engine CSV exports here, or click to choose"}</b>
        <span>Add every export from this cycle to check the $1,000 limit; duplicate rows are counted once. Read in this browser only: nothing is uploaded or saved, and closing the tab clears it.</span>
      </label>
      {error && <div className="notice err" style={{ marginTop: 8 }}>{error}</div>}

      {loaded && (
        <div className="cc-results">
          <div className="cc-block">
            <h3>Large contribution notices</h3>
            {notices.length === 0 ? (
              <div className="attn-clear">No donor in these files gave more than $500 inside a notice window.</div>
            ) : (
              <table className="tbl compact">
                <thead><tr><th>Donor</th><th className="num">In window</th><th>Went over $500</th><th>Notice due</th><th /></tr></thead>
                <tbody>
                  {notices.map((n) => {
                    const late = n.due < today;
                    return (
                      <tr key={n.name + n.window}>
                        <td>{n.name}{n.later > 0 && <div className="small muted">plus {n.later} later {n.later === 1 ? "gift" : "gifts"} in the window; ask the Board if each needs a notice</div>}</td>
                        <td className="num">{money(n.total)}</td>
                        <td>{day(n.crossed)}</td>
                        <td className={late ? "tr-late" : ""}>{day(n.due)}{late ? ", past due" : ""}</td>
                        <td><a className="small" href={`/treasurer?kind=${encodeURIComponent("Large contribution notice")}&date=${n.crossed}#start`}>Start its deadline</a></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="small muted">Counted from the gift date, the earliest the clock could start. If a payout reaches the committee later, the Board may count from then; call 651-539-1188 if unsure.</p>
          </div>

          <div className="cc-block">
            <h3>Near or over the $1,000 limit</h3>
            {limits.length === 0 ? (
              <div className="attn-clear">No donor in these files is at $800 or more for 2025-2026.</div>
            ) : (
              <table className="tbl compact">
                <thead><tr><th>Donor</th><th className="num">2025-2026 total</th><th>Status</th></tr></thead>
                <tbody>
                  {limits.map((l) => (
                    <tr key={l.name}>
                      <td>{l.name}</td>
                      <td className="num">{money(l.total)}</td>
                      <td>{l.total > LIMITS.individual
                        ? <span className="tr-late">Over by {money(l.total - LIMITS.individual)}: return within 90 days of deposit</span>
                        : l.total === LIMITS.individual ? "At the limit" : `${money(LIMITS.individual - l.total)} left`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="small muted">Only counts gifts in these files. Checks, ActBlue, in-kind gifts and a spouse giving separately are not in them.</p>
          </div>

          <div className="cc-block">
            <h3>Over $200 with no employer</h3>
            {employers.length === 0 ? (
              <div className="attn-clear">Everyone over $200 this year has an employer or occupation.</div>
            ) : (
              <table className="tbl compact">
                <thead><tr><th>Donor</th><th className="num">2026 total</th><th>Reads</th></tr></thead>
                <tbody>
                  {employers.map((e) => (
                    <tr key={e.name}><td>{e.name}</td><td className="num">{money(e.total)}</td><td>{e.reads}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="small muted">Ask the donor. &ldquo;Retired&rdquo; or &ldquo;Not employed&rdquo; is a real answer; a blank or &ldquo;No Employer&rdquo; typed into Oath may not be. Without it, the amount over $200 is returned or sent to the Board.</p>
          </div>

          <button className="btn ghost small" type="button" onClick={clear}>Clear</button>
        </div>
      )}
    </div>
  );
}
