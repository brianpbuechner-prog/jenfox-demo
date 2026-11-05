import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_DAYS } from "@/lib/demo";

export async function GET(req: NextRequest) {
  const d = req.nextUrl.searchParams.get("d") || "after";
  const back = req.nextUrl.searchParams.get("back") || "/";
  const url = req.nextUrl.clone();
  url.pathname = back.startsWith("/") ? back : "/";
  url.search = "";
  const res = NextResponse.redirect(url);
  if (DEMO_DAYS.some((x) => x.key === d)) res.cookies.set(DEMO_COOKIE, d, { path: "/", sameSite: "lax" });
  return res;
}
