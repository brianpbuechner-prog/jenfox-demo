import Link from "next/link";
import { BRIEF_LINKED } from "@/lib/config";
import { DEMO_DAYS, demoDayKey } from "@/lib/demo";
import NavLink from "./NavLink";

const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/numbers", label: "Numbers" },
  { href: "/treasurer", label: "Treasurer" },
  { href: "/party", label: "Party" },
];

export default async function Shell({ children }: { children: React.ReactNode }) {
  const day = await demoDayKey();
  return (
    <div className="shell">
      <div className="demo-bar">
        <span className="demo-tag">Portfolio demo</span>
        <span className="demo-note">Results, signs, website, email and money are real. VoteBuilder figures are sample values.</span>
        <span className="demo-days">
          View as
          {DEMO_DAYS.map((d) => (
            <a key={d.key} href={`/api/demo-day?d=${d.key}`} className={d.key === day ? "on" : ""}>{d.label}</a>
          ))}
        </span>
      </div>
      <header className="topbar">
        <Link href="/" className="logo" aria-label="Jen Fox for House">
          <span className="wm">Jen Fox for House</span>
          <span className="wm-s">Team site</span>
        </Link>
        <div className="chip">
          <span className="name">Built by Brian Buechner</span>
          <span className="chip-links">
            <a href="/signs">Sign app</a>
            <a href="https://www.jenfoxforhouse.com/" target="_blank" rel="noreferrer">Website</a>
          </span>
        </div>
      </header>
      <nav className="navbar">
        {NAV.map((n) => <NavLink key={n.href} href={n.href} label={n.label} />)}
        {BRIEF_LINKED && <a href="/brief" className="nav" target="_blank" rel="noreferrer">State of the race</a>}
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
