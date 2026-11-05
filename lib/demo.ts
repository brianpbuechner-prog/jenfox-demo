import { cookies } from "next/headers";

// The demo can be viewed as of two days: the final weekend (VoteBuilder lists, countdown)
// or the day after (result). A cookie set by /api/demo-day picks one.
export const DEMO_DAYS = [
  { key: "final", date: "2026-11-02", label: "Final weekend" },
  { key: "after", date: "2026-11-05", label: "After the election" },
] as const;
export const DEMO_COOKIE = "demo_day";

export async function demoToday(): Promise<string> {
  const c = (await cookies()).get(DEMO_COOKIE)?.value;
  return (DEMO_DAYS.find((d) => d.key === c) || DEMO_DAYS[1]).date;
}

export async function demoDayKey(): Promise<string> {
  const c = (await cookies()).get(DEMO_COOKIE)?.value;
  return (DEMO_DAYS.find((d) => d.key === c) || DEMO_DAYS[1]).key;
}
