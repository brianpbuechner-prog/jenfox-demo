// Pulls the headline and the numbered "Read first" points out of content/brief.html
// so Home always matches whichever brief was pushed last. Read once at build time.
import { readFileSync } from "node:fs";
import path from "node:path";

const strip = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export type BriefSummary = { headline: string; points: string[] };

export function getBriefSummary(): BriefSummary | null {
  try {
    const html = readFileSync(path.join(process.cwd(), "content", "brief.html"), "utf8");
    const start = html.indexOf("Read first");
    if (start < 0) return null;
    const section = html.slice(start, start + 20000);
    // An h2 marked data-home is the Home headline; otherwise the first plain h2.
    const head = section.match(/<h2[^>]*data-home[^>]*>([\s\S]*?)<\/h2>/) || section.match(/<h2>([\s\S]*?)<\/h2>/);
    // Numbered points only ("1. ..."), and stop at the next unnumbered section.
    const points: string[] = [];
    for (const m of section.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)) {
      const t = strip(m[1]);
      if (/^\d+\.\s/.test(t)) points.push(t.replace(/^\d+\.\s*/, ""));
      else if (points.length) break;
    }
    if (!head) return null;
    return { headline: strip(head[1]), points: points.slice(0, 4) };
  } catch {
    return null;
  }
}
