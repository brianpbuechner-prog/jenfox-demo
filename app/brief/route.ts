// The State of the Race visual brief, served as its own page at /brief.
// It lives in content/brief.html, NOT in public/: files in public/ are served without
// the access code. This route is behind the same middleware gate as every page.
// To hand over a newer brief, replace content/brief.html (one file) and push.
// The file is read once at build time.
import { readFileSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-static";

const html = readFileSync(path.join(process.cwd(), "content", "brief.html"), "utf8");

export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
