"use client";
// Mileage reimbursement at the CFB's 2026 rate. Added 2026-10-21.
import { useState } from "react";
import { MILEAGE } from "@/lib/deadlines";

export default function MileageCalc() {
  const [miles, setMiles] = useState("");
  const m = parseFloat(miles.replace(/,/g, ""));
  const amount = m > 0 ? Math.round(m * MILEAGE.rate * 100) / 100 : 0;
  return (
    <div className="mc">
      <label className="mc-row">
        <span>Miles driven</span>
        <input type="number" inputMode="decimal" min="0" step="0.1" value={miles} onChange={(e) => setMiles(e.target.value)} placeholder="0" />
      </label>
      <div className="mc-out">
        <span>Reimburse</span>
        <b>{"$" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
        <span className="muted small">at {MILEAGE.rate * 100}&cent; a mile</span>
      </div>
    </div>
  );
}
