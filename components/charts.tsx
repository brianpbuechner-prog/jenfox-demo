// Charts for the Home dashboard. No library: plotted marks are inline SVG or plain
// blocks, every piece of text is HTML so it stays readable at phone width. Square
// corners, brand palette, direct labels, native tooltips through title attributes.
import type { CSSProperties, ReactNode } from "react";
import { fmtDate } from "./ui";

const n = (v: number) => v.toLocaleString("en-US");

/** A figure with its date and source underneath. Greys out when stale. */
export function Fig({ label, value, sub, asOf, source, stale, estimate }: {
  label: string; value: ReactNode; sub?: ReactNode; asOf?: string | null; source: string; stale?: boolean; estimate?: boolean;
}) {
  return (
    <div className={`fig${stale ? " stale" : ""}`}>
      <div className="fig-label">{label}{estimate && <span className="est">estimate</span>}</div>
      <div className="fig-value">{value}</div>
      {sub && <div className="fig-sub">{sub}</div>}
      <Meta asOf={asOf} source={source} stale={stale} />
    </div>
  );
}

/** "As of 30 Sep 2026 · VAN". The stale tag sits on the same line. */
export function Meta({ asOf, source, stale, prefix = "As of" }: { asOf?: string | null; source: string; stale?: boolean; prefix?: string }) {
  return (
    <div className="meta">
      {asOf ? `${prefix} ${fmtDate(asOf)}` : "Not entered yet"} · {source}
      {stale && <span className="stale-tag">Out of date</span>}
    </div>
  );
}

/** Columns that hold a subset inside them, e.g. conversations inside attempts. */
export function Columns({ items, height = 150 }: {
  items: { key: string; label: string; sub?: string; total: number; part: number; totalText: string; partText: string; note?: string; tip: string; muted?: boolean }[];
  height?: number;
}) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="cols" style={{ "--cols": items.length } as CSSProperties}>
      {items.map((i) => (
        <div className={`col${i.muted ? " muted-col" : ""}`} key={i.key} title={i.tip}>
          <div className="col-plot" style={{ height }}>
            <svg className="col-svg" viewBox="0 0 10 100" preserveAspectRatio="none" role="img" aria-label={i.tip}>
              <rect x="0" y={100 - (i.total / max) * 100} width="10" height={(i.total / max) * 100} className="m-total" />
              <rect x="0" y={100 - (i.part / max) * 100} width="10" height={(i.part / max) * 100} className="m-part" />
            </svg>
            <div className="col-top" style={{ bottom: `${(i.total / max) * 100}%` }}>{i.totalText}</div>
          </div>
          <div className="col-part">{i.partText}</div>
          <div className="col-label">{i.label}</div>
          {i.sub && <div className="col-sub">{i.sub}</div>}
          {i.note && <div className="col-note">{i.note}</div>}
        </div>
      ))}
    </div>
  );
}

export interface LinePoint { x: string; y: number; tip?: string }
export interface LineSeries { name: string; cls: string; points: LinePoint[]; dashed?: boolean; endLabel?: string; dots?: boolean; labelPos?: "above" | "below" }

const dayNum = (iso: string) => Date.parse(iso + "T12:00:00Z") / 86400000;

/** Lines over dates. Marks are SVG; dots, labels and gridline values are HTML on top. */
export function LineChart({ series, start, end, yMax, yTicks, height = 170, marks = [], xTicks, label }: {
  series: LineSeries[]; start: string; end: string; yMax: number; yTicks: number[]; height?: number;
  marks?: { x: string; label: string }[]; xTicks: { x: string; label: string }[]; label: string;
}) {
  const s0 = dayNum(start), s1 = dayNum(end);
  const span = Math.max(1, s1 - s0);
  const px = (iso: string) => ((dayNum(iso) - s0) / span) * 100;
  const py = (v: number) => 100 - (v / yMax) * 100;
  return (
    <div className="line" style={{ height }} role="img" aria-label={label}>
      <div className="line-plot">
        {yTicks.map((t) => (
          <div key={t} className="grid-y" style={{ top: `${py(t)}%` }}><span>{n(t)}</span></div>
        ))}
        {marks.map((m) => (
          <div key={m.x} className="vmark" style={{ left: `${px(m.x)}%` }}><span>{m.label}</span></div>
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="line-svg" aria-hidden="true">
          {series.map((s) => s.points.length > 1 && (
            <polyline key={s.name} className={`ln ${s.cls}${s.dashed ? " dashed" : ""}`} fill="none"
              vectorEffect="non-scaling-stroke"
              points={s.points.map((p) => `${px(p.x).toFixed(3)},${py(p.y).toFixed(3)}`).join(" ")} />
          ))}
        </svg>
        {series.map((s) => s.points.map((p, idx) => {
          const last = idx === s.points.length - 1;
          if (!s.dots && !(last && s.endLabel)) return null;
          return (
            <span key={`${s.name}-${p.x}`} className={`dot ${s.cls}`} style={{ left: `${px(p.x)}%`, top: `${py(p.y)}%` }} title={p.tip || `${s.name}: ${n(p.y)}, ${fmtDate(p.x)}`} />
          );
        }))}
        {series.map((s) => {
          const p = s.points[s.points.length - 1];
          if (!p || !s.endLabel) return null;
          const left = px(p.x);
          return (
            <span key={`${s.name}-label`} className={`end-label ${s.cls}${left > 70 ? " flip" : ""}${s.labelPos ? " " + s.labelPos : ""}`} style={{ left: `${left}%`, top: `${py(p.y)}%` }}>
              {s.endLabel}
            </span>
          );
        })}
      </div>
      <div className="line-x">
        {xTicks.map((t) => <span key={t.x} style={{ left: `${px(t.x)}%` }}>{t.label}</span>)}
      </div>
    </div>
  );
}

/** One stacked bar for a part-to-whole split. Every segment is named underneath, with its count and share. */
export function Stacked({ segments, label }: { segments: { key: string; label: string; value: number; cls: string }[]; label: string }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="stacked">
      <div className="stack-bar" role="img" aria-label={label}>
        {segments.map((s) => s.value > 0 && (
          <span key={s.key} className={`seg ${s.cls}`} style={{ flexGrow: s.value }} title={`${s.label}: ${n(s.value)} (${Math.round((s.value / total) * 100)}%)`} />
        ))}
      </div>
      <ul className="stack-key">
        {segments.map((s) => (
          <li key={s.key}>
            <span className={`sw ${s.cls}`} aria-hidden="true" />
            <span className="k-label">{s.label}</span>
            <span className="k-val">{n(s.value)}</span>
            <span className="k-pct">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars with the label on the left and the value at the bar end. */
export function HBars({ rows, max }: { rows: { key: string; label: string; value: number; text: string; cls: string; tip?: string }[]; max?: number }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar" key={r.key} title={r.tip}>
          <div className="hb-label">{r.label}</div>
          <div className="hb-track">
            <span className={`hb-fill ${r.cls}`} style={{ width: `calc((100% - 6.5rem) * ${Math.max(0, Math.min(1, r.value / m)).toFixed(4)})` }} />
            <span className="hb-text">{r.text}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
