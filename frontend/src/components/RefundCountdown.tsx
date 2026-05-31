"use client";

import { useState, useEffect } from "react";

function getSecondsToNext(): number {
  const now = new Date();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const nextHalf = m < 30 ? 30 : 60;
  return (nextHalf - m) * 60 - s;
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function RefundCountdown() {
  const [secs, setSecs] = useState(getSecondsToNext);

  useEffect(() => {
    const id = setInterval(() => setSecs(getSecondsToNext()), 1000);
    return () => clearInterval(id);
  }, []);

  const pct = (1 - secs / 1800) * 100;
  const isImminent = secs < 120;

  return (
    <div className="flex items-center gap-3">
      <div>
        <p
          className="text-[10px] uppercase tracking-[0.15em]"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
        >
          Next drop
        </p>
        <p
          className="text-xl font-semibold num"
          style={{
            fontFamily: "var(--font-mono)",
            color: isImminent ? "var(--green)" : "var(--text-primary)",
          }}
        >
          {fmt(secs)}
        </p>
      </div>
      {/* Progress ring */}
      <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0">
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
        <circle
          cx="18" cy="18" r="15"
          fill="none"
          stroke={isImminent ? "var(--green)" : "var(--gold)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 15}`}
          strokeDashoffset={`${2 * Math.PI * 15 * (1 - pct / 100)}`}
          transform="rotate(-90 18 18)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
        />
      </svg>
    </div>
  );
}
