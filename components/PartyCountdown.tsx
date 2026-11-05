"use client";
import { useEffect, useRef, useState } from "react";

// Polls close 8 pm Central, Tue 3 Nov 2026. That is CST (DST ends 1 Nov), so 02:00 UTC on 4 Nov.
const POLLS_CLOSE = Date.parse("2026-11-04T02:00:00Z");

const pad = (n: number) => String(n).padStart(2, "0");

export default function PartyCountdown() {
  const [now, setNow] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fullScreen = () => {
    const el = box.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const left = now === null ? null : Math.max(0, POLLS_CLOSE - now);
  const closed = left === 0;
  const s = left === null ? 0 : Math.floor(left / 1000);
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  return (
    <div ref={box} className="party">
      <div className="party-inner">
        <div className="party-kicker">Jen Fox for House, 41B</div>
        {left === null ? (
          <div className="party-clock" aria-hidden>&nbsp;</div>
        ) : closed ? (
          <div className="party-closed">Polls are closed</div>
        ) : (
          <div className="party-clock" aria-label={`${hours} hours, ${mins} minutes, ${secs} seconds`}>
            <span className="party-unit"><b>{hours}</b><i>hours</i></span>
            <span className="party-sep">:</span>
            <span className="party-unit"><b>{pad(mins)}</b><i>minutes</i></span>
            <span className="party-sep">:</span>
            <span className="party-unit"><b>{pad(secs)}</b><i>seconds</i></span>
          </div>
        )}
        <div className="party-sub">{closed ? "Results come in as counties report." : "until polls close, 8 pm Tuesday, November 3"}</div>
      </div>
      <button type="button" className="party-fs" onClick={fullScreen}>Full screen</button>
    </div>
  );
}
