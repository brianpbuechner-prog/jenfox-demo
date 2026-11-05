import { demoToday } from "@/lib/demo";
import Link from "next/link";
import { airtableConfigured } from "@/lib/airtable";
import { getElectionSummary, getSignsDetail, getSnapshots, getWebSnapshots, type Snapshot } from "@/lib/data";
import { BRIEF_LINKED, CALENDAR, QUICK_LINKS, RACE_READ, STALE_AFTER_DAYS } from "@/lib/config";
import { EMAIL_SENDS, FIELD_BASELINE, FIELD_WEEKS, MONEY, SIGNS_PER_1000, WIX_DAILY } from "@/lib/static";
import { NotConfigured, StatusBar, daysBetween, fmtDate, todayCT } from "@/components/ui";
import { Columns, Fig, HBars, LineChart, Meta, Stacked, type LinePoint } from "@/components/charts";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("en-US");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "");
const usd = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const short = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const addDays = (iso: string, d: number) => new Date(Date.parse(iso + "T12:00:00Z") + d * 86400000).toISOString().slice(0, 10);

function niceMax(v: number): { max: number; ticks: number[] } {
  if (v <= 0) return { max: 10, ticks: [0, 5, 10] };
  const raw = v * 1.15;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => raw / s <= 4) || mag * 10;
  const max = Math.ceil(raw / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= max + 1e-9; t += step) ticks.push(Math.round(t));
  return { max, ticks };
}

function phaseLine(today: string): string {
  if (today < CALENDAR.absenteeStart) return `Absentee ballots go out ${fmtDate(CALENDAR.absenteeStart)}`;
  if (today < CALENDAR.earlyInPersonStart) return "Early voting is open: by mail, or in person at county election sites";
  if (today < CALENDAR.electionDay) return "Early voting is open, ballots go straight into the counter";
  if (today === CALENDAR.electionDay) return "Election Day";
  return "Election Day has passed";
}

/** Newest row that has every one of the given values filled in. Rows arrive newest first. */
function newestWith(rows: Snapshot[], keys: (keyof Snapshot)[]): Snapshot | null {
  return rows.find((r) => keys.every((k) => r[k] !== null && r[k] !== undefined)) || null;
}

export default async function Numbers() {
  if (!airtableConfigured()) return <NotConfigured what="Airtable" />;

  const [snapshots, signs, election, webRows] = await Promise.all([
    getSnapshots(), getSignsDetail(), getElectionSummary(), getWebSnapshots(),
  ]);

  const today = await demoToday();
  const toElection = daysBetween(today, CALENDAR.electionDay);
  // Only a dated figure can be out of date; a figure never entered says so instead.
  const isStale = (iso: string | null | undefined) => Boolean(iso) && daysBetween(iso as string, today) > STALE_AFTER_DAYS;

  const margin = election.margin2024;
  const marginLabel = margin > 0 ? `Dippel +${margin}` : `Fox +${-margin}`;

  // ---- Field ---------------------------------------------------------------
  // Rows hold cycle totals (Date From 1/1/26). Use whichever is newer: the latest
  // row, or the 30 Sep read that the September chart is built on.
  const latest = snapshots[0] || null;
  const rowNewer = latest?.updatedDate ? latest.updatedDate > FIELD_BASELINE.through : false;
  const cycle = rowNewer && latest
    ? { date: latest.updatedDate, attempts: latest.canvassAttempts, conversations: latest.conversations, source: "Sample values" }
    : { date: FIELD_BASELINE.through, attempts: FIELD_BASELINE.attempts, conversations: FIELD_BASELINE.conversations, source: "Sample values" };
  const doorRow = newestWith(snapshots, ["doorAttempts", "doorConversations"]);
  const door = doorRow && doorRow.updatedDate > FIELD_BASELINE.through
    ? { date: doorRow.updatedDate, a: doorRow.doorAttempts as number, c: doorRow.doorConversations as number, source: "Sample values" }
    : { date: FIELD_BASELINE.through, a: FIELD_BASELINE.doorAttempts, c: FIELD_BASELINE.doorConversations, source: "Sample values" };

  // October onward: the change in the cycle totals between entries.
  const ascending = [...snapshots].filter((r) => r.updatedDate).sort((a, b) => a.updatedDate.localeCompare(b.updatedDate));
  type Prev = { date: string; attempts: number; conversations: number; doorAttempts: number | null; doorConversations: number | null };
  let prev: Prev = { date: FIELD_BASELINE.through, ...FIELD_BASELINE };
  const later: { key: string; label: string; sub: string; a: number; c: number; da: number | null; dc: number | null }[] = [];
  for (const r of ascending) {
    if (r.updatedDate <= FIELD_BASELINE.through) continue;
    const a = r.canvassAttempts - prev.attempts, c = r.conversations - prev.conversations;
    if (a > 0 && c >= 0) {
      const da = r.doorAttempts !== null && prev.doorAttempts !== null ? r.doorAttempts - prev.doorAttempts : null;
      const dc = r.doorConversations !== null && prev.doorConversations !== null ? r.doorConversations - prev.doorConversations : null;
      later.push({ key: r.id, label: `to ${short(r.updatedDate)}`, sub: `since ${short(prev.date)}`, a, c, da, dc });
      prev = { date: r.updatedDate, attempts: r.canvassAttempts, conversations: r.conversations, doorAttempts: r.doorAttempts, doorConversations: r.doorConversations };
    }
  }
  const weekCols = [
    ...FIELD_WEEKS.weeks.map((w) => ({
      key: w.label, label: w.label, sub: w.range.includes("3 days") ? "3 days" : undefined,
      total: w.attempts, part: w.conversations, totalText: n(w.attempts), partText: n(w.conversations),
      note: `doors ${pct(w.doorConversations, w.doorAttempts)}`,
      tip: `${w.range}: ${n(w.attempts)} attempts, ${n(w.conversations)} conversations (${pct(w.conversations, w.attempts)}). Doors ${n(w.doorAttempts)} / ${n(w.doorConversations)}.`,
    })),
    ...later.map((l) => ({
      key: l.key, label: l.label, sub: l.sub, total: l.a, part: l.c, totalText: n(l.a), partText: n(l.c),
      note: l.da && l.dc !== null ? `doors ${pct(l.dc, l.da)}` : undefined,
      tip: `Change in cycle totals ${l.sub} ${l.label}: ${n(l.a)} attempts, ${n(l.c)} conversations.`,
    })),
  ];

  // ---- Early vote ------------------------------------------------------------
  const evRows = ascending.filter((r) => r.ballotsRequested !== null || r.alreadyVoted !== null);
  const ev = newestWith(snapshots, ["ballotsRequested", "alreadyVoted"]);
  const place = newestWith(snapshots, ["ballotsRequested", "alreadyVoted", "appsCG", "votedCG", "appsWash", "votedWash"]);
  const l2Rows = ascending.filter((r) => r.l2Returned !== null);
  const l2 = l2Rows[l2Rows.length - 1] || null;
  const evSeries = {
    apps: evRows.filter((r) => r.ballotsRequested !== null).map((r): LinePoint => ({ x: r.updatedDate, y: r.ballotsRequested as number, tip: `Applications ${n(r.ballotsRequested as number)}, ${fmtDate(r.updatedDate)}, sample` })),
    voted: evRows.filter((r) => r.alreadyVoted !== null).map((r): LinePoint => ({ x: r.updatedDate, y: r.alreadyVoted as number, tip: `Ballots cast ${n(r.alreadyVoted as number)}, ${fmtDate(r.updatedDate)}, sample` })),
    l2: l2Rows.map((r): LinePoint => ({
      x: r.updatedDate, y: r.l2Returned as number,
      tip: `Second vendor returned ${n(r.l2Returned as number)}${r.l2Returned65 !== null ? `, ${pct(r.l2Returned65, r.l2Returned as number)} aged 65+` : ""}, ${fmtDate(r.updatedDate)}`,
    })),
  };
  const evMax = niceMax(Math.max(10, ...evSeries.apps.map((p) => p.y), ...evSeries.voted.map((p) => p.y), ...evSeries.l2.map((p) => p.y)));
  const evEnd = CALENDAR.electionDay;

  // ---- Support IDs -------------------------------------------------------------
  const ids = newestWith(snapshots, ["idStrongJen", "idLeanJen", "idUndecided", "idLeanGOP", "idStrongGOP", "idNotVoting"]);
  const idSegs = ids ? [
    { key: "sj", label: "Strong Jen", value: ids.idStrongJen as number, cls: "s-sj" },
    { key: "lj", label: "Lean Jen", value: ids.idLeanJen as number, cls: "s-lj" },
    { key: "un", label: "Undecided", value: ids.idUndecided as number, cls: "s-un" },
    { key: "lg", label: "Lean GOP", value: ids.idLeanGOP as number, cls: "s-lg" },
    { key: "sg", label: "Strong GOP", value: ids.idStrongGOP as number, cls: "s-sg" },
    { key: "nv", label: "Not voting", value: ids.idNotVoting as number, cls: "s-nv" },
  ] : [];
  const idTotal = idSegs.reduce((a, s) => a + s.value, 0);
  const undRow = newestWith(snapshots, ["idUndecided", "undecidedCG"]);

  // ---- Signs --------------------------------------------------------------------
  const signsToday = today;

  // ---- Website ------------------------------------------------------------------
  const web = webRows[0] || null;
  const staticEnd = addDays(WIX_DAILY.start, WIX_DAILY.sessions.length - 1);
  const daily: LinePoint[] = WIX_DAILY.sessions.map((v, i) => ({ x: addDays(WIX_DAILY.start, i), y: v }));
  const weekly: LinePoint[] = [...webRows]
    .filter((w) => w.date > staticEnd && w.sessions7 > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({ x: w.date, y: Math.round(w.sessions7 / 7), tip: `${n(Math.round(w.sessions7 / 7))} a day on average, 7 days to ${fmtDate(w.date)} (Web Snapshot)` }));
  const webEnd = weekly.length ? weekly[weekly.length - 1].x : staticEnd;
  const webMax = niceMax(Math.max(...daily.map((p) => p.y), ...weekly.map((p) => p.y)));
  const monthTicks = (from: string, to: string) => {
    const out: { x: string; label: string }[] = [];
    const d = new Date(from.slice(0, 7) + "-01T12:00:00Z");
    while (d.toISOString().slice(0, 10) <= to) {
      const iso = d.toISOString().slice(0, 10);
      if (iso >= from) out.push({ x: iso, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return out;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Where the race stands</h1>
          <div className="sub">Numbers only. Each one shows its date and source, and anything older than {STALE_AFTER_DAYS} days greys out.</div>
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 14 }}>
        <strong>Race read:</strong> {RACE_READ.text}{" "}
        <span className="muted small">As of {fmtDate(RACE_READ.asOf)}. <a href={RACE_READ.docUrl} target="_blank" rel="noreferrer">Reasoning in the State of the Race doc</a></span>
      </div>

      <StatusBar
        items={[
          toElection > 0 ? `${toElection} days to Election Day` : toElection === 0 ? "Election Day" : "After Election Day",
          <span className="hot" key="phase">{phaseLine(today)}</span>,
          today < CALENDAR.absenteeStart
            ? `Early in-person voting opens ${fmtDate(CALENDAR.earlyInPersonStart)}`
            : today < CALENDAR.earlyInPersonStart
              ? `City halls and ballot-into-counter voting from ${fmtDate(CALENDAR.earlyInPersonStart)}`
              : `Election Day ${fmtDate(CALENDAR.electionDay)}`,
          `2024 result: ${marginLabel}`,
        ]}
      />

      {/* 2. Field ----------------------------------------------------------- */}
      <section className="card dash">
        <h2>Field</h2>
        <div className="figs">
          <Fig label="Attempts this cycle" value={n(cycle.attempts)} sub="doors and phones since Jan 1" asOf={cycle.date} source={cycle.source} stale={isStale(cycle.date)} />
          <Fig label="Conversations" value={n(cycle.conversations)} sub={`${pct(cycle.conversations, cycle.attempts)} of attempts`} asOf={cycle.date} source={cycle.source} stale={isStale(cycle.date)} />
          <Fig label="Door conversation rate" value={pct(door.c, door.a)} sub={`${n(door.c)} of ${n(door.a)} door attempts`} asOf={door.date} source={door.source} stale={isStale(door.date)} />
        </div>
        <h3 className="chart-title">Attempts by week, conversations inside</h3>
        <Columns items={weekCols} />
        <div className="caption">
          Bars: all attempts, dark part: conversations, under each week: the door conversation rate. Every field figure on this page is a sample value, in place of the VoteBuilder counts the team entered.
          {later.length > 0 && " Later bars are the change in the cycle totals between entries on the Data page, so contacts entered late land in the week they were entered."}
        </div>
        <Meta asOf={FIELD_WEEKS.asOf} source={FIELD_WEEKS.source} prefix="September weeks read" />
      </section>

      {/* 3. Early vote ------------------------------------------------------ */}
      <section className="card dash">
        <h2>Early vote</h2>
        <div className="figs">
          <Fig label="Ballot applications" value={ev ? n(ev.ballotsRequested as number) : "Not entered"} sub="district" asOf={ev?.updatedDate} source="Sample values" stale={isStale(ev?.updatedDate)} />
          <Fig label="Ballots cast" value={ev ? n(ev.alreadyVoted as number) : "Not entered"} sub={ev ? `${pct(ev.alreadyVoted as number, ev.ballotsRequested as number)} of applications` : "district"} asOf={ev?.updatedDate} source="Sample values" stale={isStale(ev?.updatedDate)} />
          <Fig label="Second vendor, returned" value={l2 ? n(l2.l2Returned as number) : "Not entered"} sub={l2 && l2.l2Returned65 !== null ? `${pct(l2.l2Returned65, l2.l2Returned as number)} aged 65 and over` : "comparison only"} asOf={l2?.updatedDate} source="Sample values" stale={isStale(l2?.updatedDate)} />
        </div>
        <h3 className="chart-title">Applications and ballots over time</h3>
        {evRows.length + l2Rows.length === 0 ? (
          <div className="empty-chart">No early vote rows yet. They are entered on the Data page.</div>
        ) : (
          <LineChart
            label="Early vote applications and ballots cast by entry date"
            start={CALENDAR.absenteeStart} end={evEnd} yMax={evMax.max} yTicks={evMax.ticks}
            xTicks={[{ x: CALENDAR.absenteeStart, label: short(CALENDAR.absenteeStart) }, { x: CALENDAR.earlyInPersonStart, label: short(CALENDAR.earlyInPersonStart) }, { x: CALENDAR.electionDay, label: short(CALENDAR.electionDay) }]}
            series={[
              { name: "Applications", cls: "c-dark", dots: true, points: evSeries.apps, endLabel: evSeries.apps.length ? `Applications ${n(evSeries.apps[evSeries.apps.length - 1].y)}` : undefined },
              { name: "Ballots cast", cls: "c-teal", dots: true, labelPos: "above", points: evSeries.voted, endLabel: evSeries.voted.length ? `Ballots ${n(evSeries.voted[evSeries.voted.length - 1].y)}` : undefined },
              { name: "Second vendor, returned", cls: "c-grey", dots: true, dashed: true, labelPos: "below", points: evSeries.l2, endLabel: evSeries.l2.length ? `Vendor ${n(evSeries.l2[evSeries.l2.length - 1].y)}` : undefined },
            ]}
          />
        )}
        <div className="caption">
          Sample values. The dashed line stands in for a second vendor&apos;s returned count, used as a cross-check:
          its party split is not used here.
        </div>
        <h3 className="chart-title">By place</h3>
        {place ? (() => {
          const cgA = place.appsCG as number, cgV = place.votedCG as number;
          const deA = (place.appsWash as number) - cgA, deV = (place.votedWash as number) - cgV;
          const hnA = (place.ballotsRequested as number) - (place.appsWash as number), hnV = (place.alreadyVoted as number) - (place.votedWash as number);
          const stale = isStale(place.updatedDate);
          return (
            <div className="figs">
              <Fig label="Cottage Grove" value={`${n(cgV)} cast`} sub={`${n(cgA)} applications`} asOf={place.updatedDate} source="Sample values" stale={stale} />
              <Fig label="Hastings and Nininger" value={`${n(hnV)} cast`} sub={`${n(hnA)} applications`} asOf={place.updatedDate} source="Sample values" stale={stale} estimate />
              <Fig label="Denmark Township" value={`${n(deV)} cast`} sub={`${n(deA)} applications`} asOf={place.updatedDate} source="Sample values" stale={stale} estimate />
            </div>
          );
        })() : <div className="empty-chart">No row with the by-place counts yet.</div>}
      </section>

      {/* 4. Support IDs ----------------------------------------------------- */}
      <section className="card dash">
        <h2>Support IDs</h2>
        {ids ? (
          <>
            <div className="figs one">
              <Fig label="People with a current support ID" value={n(idTotal)} sub="most recent response, early voters included" asOf={ids.updatedDate} source="Sample values" stale={isStale(ids.updatedDate)} />
            </div>
            <div className={isStale(ids.updatedDate) ? "stale-block" : undefined}>
              <Stacked label="Support ID split" segments={idSegs} />
            </div>
          </>
        ) : <div className="empty-chart">No row with the six support ID counts yet.</div>}
        <h3 className="chart-title">Undecided by place</h3>
        {undRow ? (
          <div className={isStale(undRow.updatedDate) ? "stale-block" : undefined}>
            <HBars rows={[
              { key: "cg", label: "Cottage Grove", value: undRow.undecidedCG as number, text: n(undRow.undecidedCG as number), cls: "c-cg" },
              { key: "ht", label: "Hastings and townships", value: (undRow.idUndecided as number) - (undRow.undecidedCG as number), text: n((undRow.idUndecided as number) - (undRow.undecidedCG as number)), cls: "c-hast", tip: "District undecided minus Cottage Grove" },
            ]} />
            <Meta asOf={undRow.updatedDate} source="Sample values" stale={isStale(undRow.updatedDate)} />
          </div>
        ) : <div className="empty-chart">No row with the Cottage Grove undecided count yet.</div>}
      </section>

      {/* 5. Signs ------------------------------------------------------------- */}
      <section className="card dash">
        <h2>Signs</h2>
        <div className="figs">
          <Fig label="Households with a sign" value={n(signs.delivered)} sub={`of ${n(signs.total)} household requests`} asOf={signsToday} source="sign app, live" />
          <Fig label="Needs delivery" value={n(signs.open)} sub={signs.hold ? `requests not yet in the ground; ${n(signs.hold)} more on hold` : "requests not yet in the ground"} asOf={signsToday} source="sign app, live" />
          <Fig label="Cottage Grove share" value={pct(signs.deliveredCG, signs.delivered)} sub={`${n(signs.deliveredCG)} of ${n(signs.delivered)} delivered, by mailing city. By precinct on ${short(SIGNS_PER_1000.asOf)}: ${SIGNS_PER_1000.cgSharePolygon}%`} asOf={signsToday} source="sign app, live" />
        </div>
        <h3 className="chart-title">Delivered signs per 1,000 target voters</h3>
        <div className={isStale(SIGNS_PER_1000.asOf) ? "stale-block" : undefined}>
          <HBars rows={SIGNS_PER_1000.rows.map((r) => ({
            key: r.label, label: r.label, value: r.value, text: `${Math.round(r.value)}`,
            cls: r.label === "Cottage Grove" ? "c-cg" : r.label === "District" ? "c-grey" : "c-hast",
            tip: `${r.signs} signs on ${n(r.targets)} target voters`,
          }))} />
        </div>
        <div className="caption">Signs are the campaign&apos;s own delivered households inside the 41B precinct lines; the target-voter denominators are sample values.</div>
        <Meta asOf={SIGNS_PER_1000.asOf} source={SIGNS_PER_1000.source} stale={isStale(SIGNS_PER_1000.asOf)} prefix="Computed" />
      </section>

      {/* 6. Website and email ---------------------------------------------------- */}
      <section className="card dash">
        <h2>Website and email</h2>
        <div className="figs four">
          <Fig label="Sessions, 7 days" value={web ? n(web.sessions7) : "Not entered"} asOf={web?.date} source="Wix, Web Snapshot" stale={isStale(web?.date)} />
          <Fig label="Visitors, 7 days" value={web ? n(web.visitors7) : "Not entered"} asOf={web?.date} source="Wix, Web Snapshot" stale={isStale(web?.date)} />
          <Fig label="Sessions, 30 days" value={web ? n(web.sessions30) : "Not entered"} asOf={web?.date} source="Wix, Web Snapshot" stale={isStale(web?.date)} />
          <Fig label="Visitors, 30 days" value={web ? n(web.visitors30) : "Not entered"} asOf={web?.date} source="Wix, Web Snapshot" stale={isStale(web?.date)} />
        </div>
        <h3 className="chart-title">Sessions per day</h3>
        <LineChart
          label="Website sessions per day since Aug 1"
          start={WIX_DAILY.start} end={webEnd} yMax={webMax.max} yTicks={webMax.ticks}
          xTicks={monthTicks(WIX_DAILY.start, webEnd)}
          marks={WIX_DAILY.marks.map((m) => ({ x: m.date, label: m.label }))}
          series={[
            { name: "Sessions", cls: "c-dark", points: daily, endLabel: weekly.length ? undefined : `${daily[daily.length - 1].y} on ${short(staticEnd)}`, labelPos: "above" },
            { name: "7-day average", cls: "c-teal", dots: true, labelPos: "above", points: weekly, endLabel: weekly.length ? `${weekly[weekly.length - 1].y} a day` : undefined },
          ]}
        />
        <div className="caption">
          Aug 1 to {short(staticEnd)}: daily sessions from Wix, captured {short("2026-10-27")}. {weekly.length ? "After that, teal points are the 7-day average from each Web Snapshot row." : "Later weeks appear as Web Snapshot rows are added."}
        </div>
        <h3 className="chart-title">Last five email sends</h3>
        <div className={`tbl-wrap${isStale(EMAIL_SENDS.asOf) ? " stale-block" : ""}`}>
          <table className="tbl compact">
            <thead><tr><th>Sent</th><th className="num">Delivered</th><th className="num">Opened</th><th className="num">Open rate</th><th className="num">Clicked</th></tr></thead>
            <tbody>
              {EMAIL_SENDS.sends.map((e) => (
                <tr key={e.date}>
                  <td>{short(e.date)}{e.subject && <div className="small muted">{e.subject}</div>}</td>
                  <td className="num">{e.delivered}</td>
                  <td className="num">{e.opened}</td>
                  <td className="num">{pct(e.opened, e.delivered)}</td>
                  <td className="num">{e.clicked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Meta asOf={EMAIL_SENDS.asOf} source={`${EMAIL_SENDS.source}. The Oct 26 send was about 25 hours old`} stale={isStale(EMAIL_SENDS.asOf)} />
      </section>

      {/* 7. Money ------------------------------------------------------------------- */}
      <section className="card dash">
        <h2>Money</h2>
        <div className="tbl-wrap">
          <table className="tbl compact">
            <thead><tr><th>Candidate committee</th><th className="num">Raised</th><th className="num">Spent</th><th className="num">Cash on hand</th></tr></thead>
            <tbody>
              {MONEY.candidates.map((c) => (
                <tr key={c.name}>
                  <td>{c.name} <span className="muted small">{c.party}</span></td>
                  <td className="num">{usd(c.raised)}</td>
                  <td className="num">{usd(c.spent)}</td>
                  <td className="num">{usd(c.cash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Meta asOf={MONEY.reportThrough} source={`CFB pre-general reports, Jan 1 to Oct 19, read ${short(MONEY.reportRead)}; Beck as amended Oct 23, including $41,295 of HRCC in-kind TV. Spending limits: Fox ${usd(MONEY.spendingLimitFox)}, Beck ${usd(MONEY.spendingLimitBeck)}, against campaign spending of ${usd(MONEY.campaignSpentFox)} and ${usd(MONEY.campaignSpentBeck)}. Counting $31 of 2025 campaign spending, Fox had ${usd(MONEY.spendingLimitFox - MONEY.campaignSpentFox - MONEY.campaignSpentFox2025)} of room on Oct 19`} prefix="Through" />
        <h3 className="chart-title">Independent expenditures in 41B, 2026</h3>
        <HBars
          max={Math.max(...MONEY.ie.rows.flatMap((r) => [r.forAmt, r.againstAmt]))}
          rows={MONEY.ie.rows.flatMap((r) => [
            { key: `${r.name}-for`, label: `For ${r.name}`, value: r.forAmt, text: usd(r.forAmt), cls: r.name === "Fox" ? "c-teal" : "c-dark" },
            { key: `${r.name}-against`, label: `Against ${r.name}`, value: r.againstAmt, text: usd(r.againstAmt), cls: r.name === "Fox" ? "c-teal-light" : "c-grey" },
          ])}
        />
        <Meta asOf={MONEY.ie.newestRow} source={`Spenders' pre-general reports, read ${short(MONEY.ie.fileRead)}. For Fox leaves out three small spenders not re-read`} prefix="Through" />
        <div className="next-report">Reported against Fox: {MONEY.ie.againstFoxNote}. No more full reports before Election Day; the next is due {fmtDate(MONEY.nextReportDue)}.</div>
      </section>

      {/* 8. Links ---------------------------------------------------------------- */}
      <nav className="link-row" aria-label="More">
        {BRIEF_LINKED && <a href="/brief" target="_blank" rel="noreferrer">State of the Race brief</a>}
        <a href={QUICK_LINKS.signAppOrg} target="_blank" rel="noreferrer">Sign routes</a>
        <Link href="/">Back to Home</Link>
      </nav>
    </>
  );
}
