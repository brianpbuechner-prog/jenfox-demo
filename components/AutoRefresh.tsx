"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-runs the server render every `seconds` while the tab is open, so live results update without a reload. */
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
