"use client";
import { useEffect, useRef, useState } from "react";

// Ingrid and Sylvie hop across the bottom of the party screen, as in the approved preview.
// Sprite sheets are one row each at 15 fps and already ping-pong, so they loop cleanly:
// tan 50 frames of 134 x 240, black and white 44 frames of 131 x 240.
// The parent decides when a run is allowed; this only plays one each time `run` changes.

export const DOG_RUN_MS = 6200;

export default function PartyDogs({ run }: { run: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [end, setEnd] = useState("1400px");
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (!run) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setStill(Boolean(reduce));
    const w = box.current?.parentElement?.clientWidth || window.innerWidth;
    setEnd(`${w + 40}px`);
    setActive(run);
    const t = setTimeout(() => setActive(0), DOG_RUN_MS);
    return () => clearTimeout(t);
  }, [run]);

  return (
    <div ref={box} className={`pd${active ? (still ? " still" : " go") : ""}`} key={active} style={{ "--end": end } as React.CSSProperties} aria-hidden={!active}>
      {active ? (
        <>
          <div className="pd-tag">Way to go, Mom!</div>
          <div className="pd-dog a"><div className="pd-sp tan" role="img" aria-label="Ingrid, the tan dog" /></div>
          <div className="pd-dog b"><div className="pd-sp bw" role="img" aria-label="Sylvie, the black and white dog" /></div>
        </>
      ) : null}
    </div>
  );
}
