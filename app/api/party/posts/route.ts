import { NextResponse } from "next/server";
import type { WallPost } from "@/lib/partyPosts";

// Portfolio demo: sample wall posts. Guest posts from the real night are not included.
export const dynamic = "force-dynamic";

const at = (h: number, m: number) => new Date(Date.UTC(2026, 10, 4, h, m)).toISOString();
const POSTS: WallPost[] = [
  { id: "demo1", name: "Sample guest", message: "Proud of this team. Every door counted.", photo: null, hidden: false, flag: "", createdTime: at(3, 40), sample: true },
  { id: "demo2", name: "Sample guest", message: "Congratulations, Representative Fox!", photo: null, hidden: false, flag: "", createdTime: at(3, 55), sample: true },
  { id: "demo3", name: "Sample guest", message: "Hastings and Cottage Grove showed up tonight.", photo: null, hidden: false, flag: "", createdTime: at(4, 10), sample: true },
];

export async function GET() {
  return NextResponse.json({ ok: true, posts: POSTS }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH() {
  return NextResponse.json({ ok: true });
}
