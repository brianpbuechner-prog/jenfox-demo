import { demoToday } from "@/lib/demo";
import { airtableConfigured } from "@/lib/airtable";
import Link from "next/link";
import { getDeadlineRows, getMoneyRows, getTasks, type DeadlineRow, type MoneyRow } from "@/lib/data";
import { saveMoney, setDeadlineDone, setFixedDone, startDeadline } from "@/lib/actions";
import { CFB, CHECKLIST, FIXED_DEADLINES, LIMITS, MILEAGE, ROLLING, addDays, inLcnWindow, isIsoDate, rollingRule, type DeadlineLink } from "@/lib/deadlines";
import { calendarToken } from "@/lib/auth";
import CfbConverter from "@/components/CfbConverter";
import ContributionCheck from "@/components/ContributionCheck";
import MileageCalc from "@/components/MileageCalc";
import { NotConfigured, Pill, StatusBar, daysBetween, todayCT } from "@/components/ui";

export const dynamic = "force-dynamic";

const shortDay = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const day = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

function count(days: number): { big: string; small: string } {
  if (days < 0) return { big: String(-days), small: -days === 1 ? "day late" : "days late" };
  if (days === 0) return { big: "Today", small: "due" };
  if (days === 1) return { big: "1", small: "day left" };
  return { big: String(days), small: "days left" };
}

/** Clock ring: the outline fills from the start date to the due date, so a fuller ring is closer. */
function Ring({ frac, big, small, toneCls }: { frac: number; big: string; small: string; toneCls: string }) {
  const r = 34, c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <div className={`ring ${toneCls}`}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className="ring-track" cx="40" cy="40" r={r} />
        <circle className="ring-fill" cx="40" cy="40" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform="rotate(-90 40 40)" />
      </svg>
      <div className="ring-text"><b className={/^\d+$/.test(big) ? undefined : "word"}>{big}</b><span>{small}</span></div>
    </div>
  );
}

/** Share of the time between `from` and `due` that has passed. */
function elapsed(today: string, from: string, due: string): number {
  const total = daysBetween(from, due);
  if (total <= 0) return today >= due ? 1 : 0;
  return daysBetween(from, today) / total;
}

function tone(days: number): string {
  if (days < 0) return "late";
  if (days <= 2) return "now";
  if (days <= 7) return "soon";
  return "";
}

const usd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** A plain progress bar against a limit. Over 100% turns red, over 80% amber.
 *  floor: the line is a minimum to reach, not a cap, so reaching it reads "Met" and never turns red.
 *  status: text shown in place of the percent (e.g. a rule that does not apply yet). */
function Bar({ label, value, max, note, neutral, floor, status }: { label: string; value: number | null; max: number; note?: string; neutral?: boolean; floor?: boolean; status?: string }) {
  if (value === null) {
    return (
      <div className="mb">
        <div className="mb-head"><span>{label}</span><span className="muted">Not entered yet</span></div>
        <div className="mb-track" />
        {note && <div className="mb-note">{note}</div>}
      </div>
    );
  }
  const pct = max > 0 ? value / max : 0;
  const cls = neutral ? "neutral" : floor ? "" : pct > 1 ? "over" : pct >= 0.8 ? "near" : "";
  const tag = status ?? (floor && pct >= 1 ? "Met" : `${Math.round(pct * 100)}%`);
  return (
    <div className={`mb ${cls}`}>
      <div className="mb-head"><span>{label}</span><span><b>{usd(value)}</b> of {usd(max)} <span className="muted">({tag})</span></span></div>
      <div className="mb-track"><span style={{ width: `${Math.min(pct, 1) * 100}%` }} /></div>
      {note && <div className="mb-note">{note}</div>}
    </div>
  );
}

/** Newest entered value for one field across the money rows (rows are newest first). */
function latest(rows: MoneyRow[], k: keyof MoneyRow): { v: number | null; asOf: string } {
  const r = rows.find((x) => typeof x[k] === "number");
  return r ? { v: r[k] as number, asOf: r.asOf } : { v: null, asOf: "" };
}

function Links({ links }: { links: DeadlineLink[] }) {
  return (
    <div className="dl-links">
      {links.map((l) => (
        l.href.startsWith("/")
          ? <a key={l.href} className="btn ghost small" href={l.href}>{l.label}</a>
          : <a key={l.href} className="btn ghost small" href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
      ))}
    </div>
  );
}

export default async function Treasurer({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (!airtableConfigured()) return <NotConfigured what="Airtable" />;
  const today = await demoToday();
  const [rows, tasks, moneyRows, calToken]: [DeadlineRow[], Awaited<ReturnType<typeof getTasks>>, MoneyRow[], string | null] =
    await Promise.all([getDeadlineRows(), getTasks(), getMoneyRows().catch(() => []), calendarToken()]);
  const feedPath = calToken ? `jenfox.emptybar.app/api/cal/${calToken}.ics` : "";
  const startKind = ROLLING.some((r) => r.kind === sp.kind) ? sp.kind! : "";
  const startDate = sp.date && isIsoDate(sp.date) ? sp.date : today;
  const cash = latest(moneyRows, "cash"), raised = latest(moneyRows, "raised"), spend = latest(moneyRows, "campaignSpending");
  const subsidy = latest(moneyRows, "subsidy"), special = latest(moneyRows, "specialSources"), party = latest(moneyRows, "partyUnits");
  const checked = new Set(rows.filter((r) => r.kind === "Fixed" && r.status === "Done").map((r) => r.key));
  // Jackie's tasks: anything assigned to her, plus open Compliance tasks with no owner.
  const jackieTasks = tasks.filter((t) => t.status !== "Done" && (t.owner === "Jackie" || (t.category === "Compliance" && !t.owner)));

  // Fixed deadlines: hide the ones whose date has passed and that were checked off.
  const fixed = FIXED_DEADLINES.map((f) => {
    const row = rows.find((r) => r.kind === "Fixed" && r.key === f.key) || null;
    const done = row?.status === "Done";
    const open = f.opens ? today >= f.opens && today <= f.due : false;
    return { f, row, done, open, days: daysBetween(today, f.due) };
  }).filter((x) => !(x.done && x.days < 0));

  const started = rows.filter((r) => r.kind !== "Fixed");
  const openRows = started.filter((r) => r.status !== "Done").sort((a, b) => a.due.localeCompare(b.due));
  const doneRows = started.filter((r) => r.status === "Done").sort((a, b) => b.doneOn.localeCompare(a.doneOn)).slice(0, 8);

  const nextFixed = fixed.filter((x) => !x.done && !x.open && x.days >= 0).sort((a, b) => a.days - b.days)[0];
  const lcnWindow = fixed.find((x) => x.open);
  const lateCount = openRows.filter((r) => daysBetween(today, r.due) < 0).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Treasurer</h1>
          <div className="sub">Jackie&apos;s page: deadlines with countdowns, a contribution check, money against the limits, her tasks and the CFB tools. Dates from the CFB 2026 calendar and candidate handbook, counted in Central time.</div>
        </div>
      </div>

      <StatusBar
        items={[
          nextFixed
            ? `${nextFixed.f.title}: ${nextFixed.days === 0 ? "due today" : nextFixed.days === 1 ? "due tomorrow" : `${nextFixed.days} days`}`
            : "No fixed deadlines left",
          ...(lcnWindow ? [<span className="hot" key="w">{lcnWindow.f.title} open through {day(lcnWindow.f.due)}</span>] : []),
          `${openRows.length} started ${openRows.length === 1 ? "deadline" : "deadlines"} open${lateCount ? `, ${lateCount} late` : ""}`,
        ]}
      />

      <nav className="tr-jump" aria-label="On this page">
        <a href="#due">Coming due</a><a href="#check">Contribution check</a><a href="#convert">CFRO import</a><a href="#started">Started deadlines</a>
        <a href="#money">Money</a><a href="#beck">Opponent reports</a><a href="#tools">Tasks and tools</a><a href="#after">After Election Day</a><a href="#amounts">Amounts</a>
      </nav>

      {/* 1. Fixed deadlines ------------------------------------------------------ */}
      <section className="card dl-section" id="due">
        <div className="eyebrow">From the 2026 calendar</div>
        <h2>Coming due</h2>
        <div className="dl-list">
          {fixed.map(({ f, row, done, open, days }) => {
            const c = open ? { big: String(days), small: days === 1 ? "day left" : "days left" } : count(days);
            const from = f.countFrom || f.opens || addDays(f.due, -30);
            const frac = done ? 1 : days < 0 ? 1 : elapsed(today, from, f.due);
            return (
              <div key={f.key} className={`dl ${done ? "done" : open ? "window" : tone(days)}`}>
                {done
                  ? <Ring frac={1} big={"\u2713"} small={row?.doneOn ? shortDay(row.doneOn) : "done"} toneCls="done" />
                  : <Ring frac={frac} big={c.big} small={c.small} toneCls={open ? "window" : tone(days) || "far"} />}
                <div className="dl-body">
                  <div className="dl-title">
                    {f.title}
                    {open && !done && <span className="pill mint">Open now</span>}
                  </div>
                  <div className="dl-when">
                    {f.opens ? `${day(f.opens)} through ${day(f.due)}` : `Due ${day(f.due)}`}
                  </div>
                  {!done && <p className="dl-what">{f.what}</p>}
                  {!done && f.late && <p className="dl-late">Late fee: {f.late}</p>}
                  {!done && <Links links={f.links} />}
                </div>
                {f.opens ? <div /> : <form action={setFixedDone} className="dl-act">
                  <input type="hidden" name="key" value={f.key} />
                  <input type="hidden" name="id" value={row?.id || ""} />
                  <input type="hidden" name="done" value={done ? "0" : "1"} />
                  <button className={`btn small${done ? " ghost" : ""}`} type="submit">{done ? "Undo" : "Mark done"}</button>
                </form>}
              </div>
            );
          })}
        </div>
        {feedPath && (
          <details className="tr-cal">
            <summary>Put these deadlines in your phone&apos;s calendar</summary>
            <p className="small">On an iPhone, tap <a href={`webcal://${feedPath}`}>Subscribe on this device</a>. In Google Calendar on a computer: Other calendars, +, From URL, and paste the link below. Each deadline comes with a reminder the morning before. Google can take up to a day to pick up changes; Apple checks every few hours.</p>
            <code className="tr-feed">https://{feedPath}</code>
            <p className="small muted">The link works without the access code, so keep it to the treasurer&apos;s own calendar. It holds deadline titles and dates only.</p>
          </details>
        )}
      </section>

      {/* 1b. Contribution check -------------------------------------------------- */}
      <section className="card dl-section" id="check">
        <div className="eyebrow">Oath and Democracy Engine exports, read in your browser</div>
        <h2>Contribution check</h2>
        <p className="card-sub" style={{ marginTop: 0 }}>Finds large contribution notices due, donors near the $1,000 limit, and gifts over $200 with no employer.</p>
        <ContributionCheck />
      </section>

      {/* 1c. CFRO import converter ---------------------------------------------- */}
      <section className="card dl-section" id="convert">
        <div className="eyebrow">Oath or Democracy Engine export to CFRO, read in your browser</div>
        <h2>Make the CFRO import file</h2>
        <p className="card-sub" style={{ marginTop: 0 }}>Drop one export at a time. Then in CFRO: Maintenance, Import, Receipts, choose the downloaded file, check the Valid column, Import.</p>
        <CfbConverter depositStarts={rows.filter((r) => r.kind === "Deposit").map((r) => r.started)} />
      </section>

      {/* 2. Started deadlines ---------------------------------------------------- */}
      <section className="card dl-section" id="started">
        <div className="eyebrow">Started from a date</div>
        <h2>Started deadlines</h2>
        {sp.started && <div className="notice">Started. It is in the list below.</div>}
        {openRows.length === 0 ? (
          <div className="attn-clear">Nothing started is open right now.</div>
        ) : (
          <div className="dl-list">
            {openRows.map((r) => {
              const rule = rollingRule(r.kind);
              const days = daysBetween(today, r.due);
              const c = count(days);
              const frac = days < 0 ? 1 : elapsed(today, r.started || today, r.due);
              const outside = r.kind === "Large contribution notice" && r.started && !inLcnWindow(r.started);
              return (
                <div key={r.id} className={`dl ${tone(days)}`}>
                  <Ring frac={frac} big={c.big} small={c.small} toneCls={tone(days) || "far"} />
                  <div className="dl-body">
                    <div className="dl-title">
                      {rule?.label || r.kind}
                      {outside && <span className="pill warn">Date is outside the notice window</span>}
                    </div>
                    <div className="dl-when">
                      Due {day(r.due)} · {rule?.startLabel || "Started"} {day(r.started)}
                      {rule ? ` · ${rule.days} ${rule.business ? "business " : ""}${rule.days === 1 ? "day" : "days"}` : ""}
                    </div>
                    {r.note && <p className="dl-what">{r.note}</p>}
                    {rule?.link && <Links links={[rule.link]} />}
                  </div>
                  <form action={setDeadlineDone} className="dl-act">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="done" value="1" />
                    <button className="btn small" type="submit">Mark done</button>
                  </form>
                </div>
              );
            })}
          </div>
        )}

        {doneRows.length > 0 && (
          <details className="dl-done">
            <summary>Recently done ({doneRows.length})</summary>
            <ul>
              {doneRows.map((r) => (
                <li key={r.id}>
                  <span>{rollingRule(r.kind)?.label || r.kind}, started {day(r.started)}{r.note ? `: ${r.note}` : ""}</span>
                  <span className="muted">Done {r.doneOn ? day(r.doneOn) : ""}</span>
                  <form action={setDeadlineDone}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="done" value="0" />
                    <button className="linkish" type="submit">Reopen</button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* 3. Start one ------------------------------------------------------------ */}
      <section className="card dl-section" id="start">
        <div className="eyebrow">Start a deadline</div>
        <h2>Got a contribution, a correction or a change?</h2>
        {sp.err && <div className="notice err">Pick a kind and a date, then try again.</div>}
        <div className="dl-start">
          <form action={startDeadline} className="edit">
            <label>What happened
              <select name="kind" required defaultValue={startKind}>
                <option value="" disabled>Choose one</option>
                {ROLLING.map((r) => <option key={r.kind} value={r.kind}>{r.label}</option>)}
              </select>
            </label>
            <label>Date it happened
              <input type="date" name="started" defaultValue={startDate} required />
            </label>
            <label>Note (optional)
              <input type="text" name="note" maxLength={200} placeholder="e.g. checks from the 24 Oct house party" />
            </label>
            <p className="small muted">No donor names, amounts or bank details here. Those stay in CFRO.</p>
            <div className="actions"><button className="btn" type="submit">Start the clock</button></div>
          </form>
          <div>
            <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>How each one is counted</div>
            <ul className="dl-rules">
              {ROLLING.map((r) => (
                <li key={r.kind}>
                  <b>{r.label}</b>
                  <span>{r.rule} <a href={`${CFB.handbook}#page=${r.page}`} target="_blank" rel="noreferrer">Handbook p. {r.page}</a></span>
                </li>
              ))}
            </ul>
            <p className="small muted">Business days skip weekends and Minnesota state holidays. Calendar-day deadlines are not moved off weekends here, so file early when one lands on a Saturday or Sunday.</p>
          </div>
        </div>
      </section>

      {/* 3b. Money ----------------------------------------------------------------- */}
      <section className="card dl-section" id="money">
        <div className="eyebrow">Committee totals, entered after each filing</div>
        <h2>Money against the limits</h2>
        {sp.saved === "money" && <div className="notice">Saved.</div>}
        {sp.moneyErr && <div className="notice err">Add the date the totals are as of, then save again.</div>}
        <div className="figs four" style={{ marginBottom: 14 }}>
          {[{ l: "Cash on hand", x: cash }, { l: "Raised this year", x: raised }, { l: "Campaign spending", x: spend }, { l: "Public subsidy received", x: subsidy }].map(({ l, x }) => (
            <div className="fig" key={l}>
              <div className="fig-label">{l}</div>
              <div className="fig-value">{x.v === null ? "Not entered" : usd(x.v)}</div>
              <div className="meta">{x.asOf ? `As of ${day(x.asOf)}` : "Enter from the next report"}</div>
            </div>
          ))}
        </div>
        <div className="mb-list">
          <Bar label="Campaign spending against the spending limit" value={spend.v} max={LIMITS.spending}
            note={`Base limit. ${usd(LIMITS.spendingFirstTime)} if Jen qualifies as a first-time candidate; the Board can confirm.`} />
          <Bar label="Campaign spending against the public subsidy" value={spend.v === null || subsidy.v === null ? null : spend.v} max={subsidy.v || 0} floor
            note={spend.v !== null && subsidy.v !== null
              ? spend.v >= subsidy.v ? "Spending covers the subsidy, so none goes back." : `${usd(subsidy.v - spend.v)} more in campaign spending by 31 Dec, or that much goes back to the Board.`
              : "Needs both totals. Spending has to reach the subsidy by 31 Dec or the difference goes back."} />
          <Bar label="Lobbyists, political committees and unregistered groups" value={special.v} max={LIMITS.specialSources} />
          <Bar label="Party units and terminating candidate committees" value={party.v} max={LIMITS.partyUnits} />
          <Bar label="Cash on hand against the carry-forward limit" value={cash.v} max={LIMITS.carryForward} neutral={today < "2026-11-04"} status={today < "2026-11-04" ? "Applies 31 Dec" : undefined}
            note="Only matters on 31 Dec. Cash over the limit then has to come down or goes to the state elections campaign fund." />
        </div>
        <details className="tr-money-form">
          <summary>Enter totals from a report</summary>
          <form action={saveMoney} className="edit" style={{ marginTop: 10 }}>
            <div className="row">
              <label>Which report<input type="text" name="label" placeholder="Pre-general report" /></label>
              <label>Totals as of<input type="date" name="asOf" required defaultValue="2026-10-19" /></label>
            </div>
            <div className="row three">
              <label>Cash on hand<input type="text" inputMode="decimal" name="cash" /></label>
              <label>Raised this year<input type="text" inputMode="decimal" name="raised" /></label>
              <label>Campaign spending, 2025-26<input type="text" inputMode="decimal" name="campaignSpending" /></label>
              <label>Public subsidy received<input type="text" inputMode="decimal" name="subsidy" /></label>
              <label>Special sources, 2025-26<input type="text" inputMode="decimal" name="specialSources" /></label>
              <label>Party units, 2025-26<input type="text" inputMode="decimal" name="partyUnits" /></label>
            </div>
            <label>Note (optional)<input type="text" name="notes" maxLength={500} /></label>
            <p className="small muted" style={{ margin: 0 }}>Committee totals only, straight off the report summary. Leave a box blank if you don&apos;t have it; blanks are skipped, not saved as zero. Campaign spending excludes noncampaign disbursements.</p>
            <div className="actions"><button className="btn" type="submit">Save totals</button></div>
          </form>
          {moneyRows.length > 0 && (
            <p className="small muted" style={{ marginTop: 8 }}>
              Entered so far: {moneyRows.map((m) => `${m.label || "Totals"} (${day(m.asOf)})`).join(", ")}. Edit or remove rows in Airtable, table Treasurer Money.
            </p>
          )}
        </details>
      </section>

      {/* 3c. Opponents' reports checked (27 Oct) ------------------------------------- */}
      <section className="card dl-section" id="beck">
        <div className="eyebrow">Checked 27 Oct: nothing to act on</div>
        <h2>Beck and Dippel reports</h2>
        <p style={{ marginTop: 0 }}>
          <strong>Party money is within the rules.</strong> On 9 Jul 2026 the Board stopped counting in-kind contributions and approved expenditures from party units
          toward the $10,000 party cap (after the Supreme Court&apos;s NRSC v. FEC ruling). Only party cash counts: Beck $9,350 (including a $1,000 notice on 21 Oct),
          Dippel $7,400. So HRCC&apos;s $41,295 of TV for Beck and the Senate GOP caucus&apos;s $127,566 of mail and ads for Dippel (through 21 Oct) are allowed.
        </p>
        <p>
          <strong>Beck&apos;s spending limit.</strong> He signed the public subsidy agreement, so his $92,620 limit counts party in-kind. Campaign spending through 19 Oct
          was $73,926 (2025 and 2026), leaving about $18,700. More HRCC TV for him after 19 Oct would count against it. Dippel has no limit (no agreement) and has lent
          his campaign $42,000.
        </p>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Minor, self-reported: Dippel refunded $41.02 of an over-limit gift on 4 Sep, and three of his next-day notices for Saturday 24 Oct gifts reached the Board
          Monday 26 Oct, possibly a day late. Both are small. No itemized donor over the $1,000 limit for either across 2025 and 2026. Sources: CFB reports for Beck (19245, amendment 2;
          2025 year-end), Dippel (19246; 2025 year-end; notices to 26 Oct); Board notice on NRSC v. FEC, 9 Jul 2026.
        </p>
      </section>

      {/* 4. Tasks and tools ------------------------------------------------------ */}
      <div className="grid two" style={{ marginBottom: 18 }} id="tools">
        <section className="card dl-section" style={{ marginBottom: 0 }}>
          <div className="eyebrow">From the Tasks list</div>
          <h2>Jackie&apos;s tasks</h2>
          {jackieTasks.length === 0 ? (
            <div className="attn-clear">No open tasks for Jackie.</div>
          ) : (
            <ul className="tr-tasks">
              {jackieTasks.map((t) => {
                const d = t.due ? daysBetween(today, t.due) : null;
                return (
                  <li key={t.id}>
                    <span className="tt">{t.title}</span>
                    {t.due && <span className={`muted small${d !== null && d < 0 ? " tr-late" : ""}`}>{d !== null && d < 0 ? `${-d} days late` : `Due ${day(t.due)}`}</span>}
                    {t.status === "In progress" && <Pill tone="mint">In progress</Pill>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card dl-section" style={{ marginBottom: 0 }}>
          <div className="eyebrow">CFB tools</div>
          <h2>Filing and help</h2>
          <div className="link-grid tr-tools">
            <a href={CFB.cfro} target="_blank" rel="noreferrer"><b>CFRO sign-in</b><span>Reports, imports and records</span></a>
            <a href={CFB.notice} target="_blank" rel="noreferrer"><b>Large contribution notice</b><span>File one, 20 Oct to 2 Nov</span></a>
            <a href="#convert"><b>CFRO import converter</b><span>Oath or Democracy Engine export, on this page</span></a>
            <a href={CFB.calendar} target="_blank" rel="noreferrer"><b>2026 calendar</b><span>Every House filing date</span></a>
            <a href={CFB.handbook} target="_blank" rel="noreferrer"><b>Candidate handbook</b><span>Rules, limits and penalties</span></a>
            <a href={`tel:${CFB.reportingPhone.replace(/-/g, "")}`}><b>Reporting help</b><span>{CFB.reportingPhone}, or main line {CFB.phone}</span></a>
          </div>
          <div className="small" style={{ fontWeight: 700, margin: "14px 0 4px" }}>Importing an Oath or Democracy Engine export</div>
          <ol className="tr-steps small">
            <li>Drop the CSV on <a href="#convert">the converter</a> and download the CFRO file. It flags anyone over $200 with no employer.</li>
            <li>In CFRO: Maintenance, Import, Receipts, choose the converted file.</li>
            <li>Check the Valid column. Fix any row reading false, then Import.</li>
          </ol>
          <p className="small muted" style={{ margin: 0 }}>Convert straight from the export. Opening it in Excel first drops the leading zero from some zip codes.</p>
        </section>
      </div>

      {/* 4b. After Election Day and mileage ------------------------------------- */}
      <div className="grid two" style={{ marginBottom: 18 }} id="after">
        <section className="card dl-section" style={{ marginBottom: 0 }}>
          <div className="eyebrow">From 4 Nov through 31 Dec</div>
          <h2>After Election Day</h2>
          <ul className="tr-check">
            {CHECKLIST.map((c) => {
              const row = rows.find((r) => r.kind === "Fixed" && r.key === c.key);
              const done = checked.has(c.key);
              return (
                <li key={c.key} className={done ? "done" : ""}>
                  <form action={setFixedDone}>
                    <input type="hidden" name="key" value={c.key} />
                    <input type="hidden" name="id" value={row?.id || ""} />
                    <input type="hidden" name="done" value={done ? "0" : "1"} />
                    <button type="submit" className="tr-box" aria-label={done ? `Uncheck ${c.title}` : `Check off ${c.title}`}>{done ? "✓" : ""}</button>
                  </form>
                  <div><b>{c.title}</b><span>{c.detail}</span></div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card dl-section" style={{ marginBottom: 0 }}>
          <div className="eyebrow">CFB 2026 mileage memo</div>
          <h2>Mileage reimbursement</h2>
          <MileageCalc />
          <p className="small" style={{ marginTop: 12 }}>Reimbursing is optional. If the driver skips it, nothing is reported. If the committee pays, report it as a campaign expenditure, and pay mileage in money: no gas cards or fuel purchases.</p>
          <a className="small" href={MILEAGE.memo} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>Read the memo</a>
        </section>
      </div>

      {/* 5. Thresholds ------------------------------------------------------------ */}
      <section className="card dl-section" id="amounts">
        <div className="eyebrow">2025-2026 House limits</div>
        <h2>Amounts that trigger something</h2>
        <table className="tbl compact dl-amounts">
          <tbody>
            <tr><td className="num"><b>$20</b></td><td>Under it, a cash gift needs only the date and amount, and in-kind needs nothing. An anonymous gift over it goes to the Board.</td></tr>
            <tr><td className="num"><b>$100</b></td><td>Keep an invoice or receipt for any vendor paid or owed more than this in the year.</td></tr>
            <tr><td className="num"><b>$200</b></td><td>Over it in the calendar year, itemize the donor with name, address and employer (occupation if self-employed). Also the most an unregistered group can give without a disclosure form.</td></tr>
            <tr><td className="num"><b>$500</b></td><td>More than this from one source during a notice window means a large contribution notice by the next business day.</td></tr>
            <tr><td className="num"><b>$1,000</b></td><td>Most one person can give for 2025-2026, counting cash, in-kind and loans. Spouses each have their own limit.</td></tr>
            <tr><td className="num"><b>$5,000</b></td><td>Most Jen can give her own committee, since she signed the public subsidy agreement.</td></tr>
            <tr><td className="num"><b>$10,000</b></td><td>Combined from all party units and terminating candidate committees.</td></tr>
            <tr><td className="num"><b>$16,800</b></td><td>Combined from lobbyists, political committees and funds, and unregistered associations.</td></tr>
            <tr><td className="num"><b>$84,200</b></td><td>Base spending limit for the cycle. $92,620 if Jen qualifies as a first-time candidate; the Board can confirm.</td></tr>
          </tbody>
        </table>
      </section>

    </>
  );
}
