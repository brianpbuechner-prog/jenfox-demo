import Link from "next/link";

export function Stat({ label, value, hint, stale }: { label: string; value: string | number; hint?: React.ReactNode; stale?: boolean }) {
  return (
    <div className={`card stat${stale ? " stale" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
      {stale && <div className="stale-tag">Needs refreshing</div>}
    </div>
  );
}

export function Pill({ children, tone }: { children: React.ReactNode; tone?: "dark" | "mint" | "ok" | "warn" | "grey" }) {
  return <span className={`pill${tone ? " " + tone : ""}`}>{children}</span>;
}

export function NotConfigured({ what }: { what: string }) {
  return (
    <div className="notice">
      <strong>{what} is not connected yet.</strong> Add the environment variables described in the setup notes and redeploy.
    </div>
  );
}

export function fmtDate(s: string | undefined | null): string {
  if (!s) return "";
  const d = new Date(s.length === 10 ? s + "T12:00:00" : s);
  if (isNaN(d.getTime())) return s;
  // Central time: the server runs in UTC, so a full timestamp would roll over to the next day at 7 pm.
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" });
}

export function fmtMoney(n: number | undefined | null): string {
  if (n == null) return "";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="small" style={{ textDecoration: "none" }}>&larr; {label}</Link>;
}

// --- Added 2026-09-18 for the Home rebuild ---

/** Today in campaign local time as YYYY-MM-DD. The server runs in UTC, so a plain
 *  new Date() rolls over at 7pm Central and the countdown would read a day early. */
export function todayCT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Whole days from one YYYY-MM-DD to another. Noon anchors avoid DST edges. */
export function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO + "T12:00:00Z");
  const b = Date.parse(toISO + "T12:00:00Z");
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function StatusBar({ items }: { items: React.ReactNode[] }) {
  return (
    <div className="statusbar">
      {items.map((it, idx) => (
        <span className="sb-item" key={idx}>{it}</span>
      ))}
    </div>
  );
}

/** Renders only what is actually open. An empty list is a sentence, not four empty boxes. */
export function Attention({ items }: { items: { key: string; text: React.ReactNode }[] }) {
  if (items.length === 0) {
    return <div className="attn-clear">Nothing is waiting on a person right now.</div>;
  }
  return (
    <ul className="attn">
      {items.map((it) => <li key={it.key}>{it.text}</li>)}
    </ul>
  );
}

// --- Added 2026-09-23 with the top-bar layout ---

import { Icon, type IconName } from "./Icon";

/** Card heading in the portal style: line icon, title, faint watermark. */
export function CardHead({ icon, title, sub, right }: { icon: IconName; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <>
      <Icon name={icon} className="watermark" />
      <div className="card-head">
        <Icon name={icon} className="ico" />
        <h3>{title}</h3>
        <span className="spacer" />
        {right}
      </div>
      {sub && <p className="card-sub">{sub}</p>}
    </>
  );
}

export function CardFoot({ children }: { children: React.ReactNode }) {
  return <div className="card-foot">{children}</div>;
}

export function KV({ icon, label, children }: { icon?: IconName; label: string; children: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="k">{icon && <Icon name={icon} size={18} />}{label}</span>
      <span className="v">{children}</span>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="big-empty">{children}</div>;
}
