import { NextResponse } from "next/server";

// Portfolio demo: the phone remote is not part of the demo, so there are never queued commands.
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json({ ok: true, commands: [], status: null, recent: [] });
}
export async function POST() {
  return NextResponse.json({ ok: true });
}
