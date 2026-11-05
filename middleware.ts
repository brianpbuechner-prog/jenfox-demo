import { NextRequest, NextResponse } from "next/server";

// Portfolio demo: no access code. The login page just goes home.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/login")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/login"] };
