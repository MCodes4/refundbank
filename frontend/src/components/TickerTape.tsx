"use client";

import { type Distribution } from "@/lib/supabase";
import { shortWallet, formatSol } from "@/lib/format";

interface Props { distributions: Distribution[]; }

const PLACEHOLDER = [
  "Paybag initialising",
  "First drop pending",
  "Waiting for volume",
];

export default function TickerTape({ distributions }: Props) {
  const items = distributions.length > 0
    ? distributions.slice(0, 24).map(
        (d) => `${shortWallet(d.recipient_wallet)} received ${formatSol(d.amount_sol, 4)} SOL`
      )
    : PLACEHOLDER;

  const doubled = [...items, ...items];

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        height: "32px",
        background: "var(--surface)",
      }}
    >
      <div className="ticker-track inline-flex items-center h-full">
        {doubled.map((text, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 px-7"
            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px" }}
          >
            <span style={{ color: "var(--text-3)", opacity: 0.5 }}>·</span>
            <span style={{ color: "var(--text-3)" }}>{text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
