"use client";
// CFB import converter on /treasurer, added 2026-10-21.
// Reads an Oath or Democracy Engine CSV in this browser only and builds the file CFRO
// imports. Nothing is uploaded, sent or saved: the download is made in the page.
import { useState } from "react";
import { SOURCE_LABEL, convert, toCSV, type Conversion } from "@/lib/cfbImport";
import { startDeadline } from "@/lib/actions";

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const todayCT = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** depositStarts: dates of Deposit deadlines already in the Deadlines table, so the same file can't start a second clock. */
export default function CfbConverter({ depositStarts = [] }: { depositStarts?: string[] }) {
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<Conversion | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function load(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setResult(null); setError(""); setFileName(f.name);
    if (!/\.csv$/i.test(f.name)) { setError(`${f.name} is not a CSV. Use the CSV straight from Oath or Democracy Engine.`); return; }
    const out = convert(await f.text(), Number(todayCT().slice(0, 4)));
    if ("error" in out) setError(out.error);
    else setResult(out);
  }

  function download() {
    if (!result) return;
    const blob = new Blob([toCSV(result.receipts)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Jen_Fox_CFB_Receipts_${SOURCE_LABEL[result.source].replace(/ /g, "")}_${todayCT()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function clear() { setResult(null); setError(""); setFileName(""); }

  const r = result;
  return (
    <div className="cc">
      <label
        className={`cc-drop${dragOver ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); load(e.dataTransfer.files); }}
      >
        <input type="file" accept=".csv,text/csv" onChange={(e) => { load(e.target.files); e.target.value = ""; }} />
        <b>{r ? `${SOURCE_LABEL[r.source]} export read: ${fileName}` : "Drop an Oath or Democracy Engine CSV here, or click to choose"}</b>
        <span>It works out which one it is. Read in this browser only: nothing is uploaded or saved.</span>
      </label>
      {error && <div className="notice err" style={{ marginTop: 8 }}>{error}</div>}

      {r && (
        <div className="cc-results">
          <div className="figs four" style={{ width: "100%" }}>
            <div className="fig"><div className="fig-label">Receipts</div><div className="fig-value">{r.receipts.length}</div><div className="meta">{r.skipped ? `${r.skipped} left out, see below` : "Every row converted"}</div></div>
            <div className="fig"><div className="fig-label">Gross</div><div className="fig-value">{money(r.gross)}</div><div className="meta">What CFRO records</div></div>
            <div className="fig"><div className="fig-label">Fees</div><div className="fig-value">{money(r.fees)}</div><div className="meta">A separate expenditure</div></div>
            <div className="fig"><div className="fig-label">Net</div><div className="fig-value">{money(r.gross - r.fees)}</div><div className="meta">Should match the deposit</div></div>
          </div>

          <div className="cc-block">
            <h3>Check before importing</h3>
            {r.warnings.length === 0
              ? <div className="attn-clear">Nothing to fix. Every row has a date this year, an address, a valid zip, and an employer where one is needed.</div>
              : <ul className="small" style={{ margin: 0, paddingLeft: "1.2em" }}>{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
          </div>

          {(r.fundsDates.length > 0 || r.undated > 0) && (
            <div className="cc-block">
              <h3>Deposit clock</h3>
              <p className="small" style={{ margin: "0 0 8px" }}>Online gifts count as received when the money is available, and have to be deposited within 10 business days.</p>
              <div style={{ display: "grid", gap: 8 }}>
                {r.fundsDates.map((f) => depositStarts.includes(f.date) ? (
                  <div key={f.date} className="attn-clear">Deposit clock for money available {day(f.date)} is already started.</div>
                ) : (
                  <form key={f.date} action={startDeadline} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="hidden" name="kind" value="Deposit" />
                    <input type="hidden" name="started" value={f.date} />
                    <input type="hidden" name="note" value={`${SOURCE_LABEL[r.source]} payment, ${f.receipts} ${f.receipts === 1 ? "receipt" : "receipts"}`} />
                    <button className="btn small" type="submit">Start the deposit clock from {day(f.date)}</button>
                    <span className="small muted">{f.receipts} {f.receipts === 1 ? "receipt" : "receipts"} available that day. Saves only the date and a note, no names or amounts.</span>
                  </form>
                ))}
                {r.undated > 0 && (
                  <form action={startDeadline} style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
                    <input type="hidden" name="kind" value="Deposit" />
                    <input type="hidden" name="note" value={`${SOURCE_LABEL[r.source]} payment, ${r.undated} ${r.undated === 1 ? "receipt" : "receipts"}`} />
                    <label className="small" style={{ display: "grid", gap: 4 }}>
                      Date the money arrived
                      <input type="date" name="started" required defaultValue={todayCT()} max={todayCT()} />
                    </label>
                    <button className="btn small" type="submit">Start the deposit clock</button>
                    <span className="small muted" style={{ flexBasis: "100%" }}>
                      {r.undated} {r.undated === 1 ? "receipt has" : "receipts have"} no payment date in this file yet{r.source === "democracy-engine" ? " (Payment Posted On is blank)" : ""}. Start the clock once the money shows up in the bank. Saves only the date and a note, no names or amounts.
                    </span>
                  </form>
                )}
              </div>
            </div>
          )}

          <div className="actions" style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="button" onClick={download} disabled={!r.receipts.length}>Download the CFRO file</button>
            <button className="btn ghost" type="button" onClick={clear}>Clear</button>
          </div>

          <details className="cc-block">
            <summary className="small">See the {r.receipts.length} rows</summary>
            <div style={{ overflowX: "auto" }}>
              <table className="tbl compact">
                <thead><tr><th>Date</th><th className="num">Amount</th><th>Name</th><th>Address</th><th>Employment</th></tr></thead>
                <tbody>
                  {r.receipts.map((x, i) => (
                    <tr key={i}>
                      <td>{x.ReceiptDate}</td>
                      <td className="num">{x.ReceiptAmount}</td>
                      <td>{x.FirstName} {x.LastName}</td>
                      <td>{[x.Address1, x.Address2, x.City, x.State, x.Zip].filter(Boolean).join(", ")}</td>
                      <td>{x.Employment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
