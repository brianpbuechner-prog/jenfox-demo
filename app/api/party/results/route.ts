import { NextResponse } from "next/server";
import results from "@/lib/partyResults.json";

// Portfolio demo: the final unofficial feed, captured from the MN Secretary of State's
// results files on 5 Nov 2026 by the live version of this route. Public data.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(results, { headers: { "Cache-Control": "no-store" } });
}
