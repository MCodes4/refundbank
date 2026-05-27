"use client";

import { useState } from "react";
import { supabase, type Holder } from "@/lib/supabase";
import { formatSol } from "@/lib/format";
import { useInView } from "@/hooks/useInView";

export default function CheckWallet({ allHolders }: { allHolders: Holder[] }) {
  const { ref, inView } = useInView();
  const [input, setInput]   = useState("");
  const [result, setResult] = useState<Holder | null | "not-found">(null);
  const [loading, setLoading] = useState(false);

  const sorted = [...allHolders].sort((a, b) => a.pnl_sol - b.pnl_sol);

  async function lookup() {
    const addr = input.trim();
    if (!addr || addr.length < 32) return;
    setLoading(true);
    const { data } = await supabase.from("holders").select("*").eq("wallet", addr).single();
    setResult(data ?? "not-found");
    setLoading(false);
  }

  const holder = result && result !== "not-found" ? result : null;
  const rank   = holder ? sorted.findIndex((h) => h.wallet === holder.wallet) + 1 : null;
  const inTop20 = rank !== null && rank <= 20;

  const estimatedShare = holder && inTop20 && sorted.length > 0
    ? (() => {
        const totalLoss = sorted.slice(0, 20).reduce((s, h) => s + Math.abs(h.pnl_sol), 0);
        return totalLoss > 0 ? (Math.abs(holder.pnl_sol) / totalLoss) * 100 : 0;
      })()
    : null;

  const solToTop = holder && !inTop20 && sorted[19]
    ? Math.abs(sorted[19].pnl_sol) - Math.abs(holder.pnl_sol)
    : null;

  return (
    <section
      id="check"
      ref={ref}
      className={`reveal ${inView ? "visible" : ""}`}
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="px-6 sm:px-8 pt-8 pb-12">
        <h2
          className="section-label text-xl font-medium mb-2"
          style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
        >
          Are you in line?
        </h2>
        <p className="mt-2 mb-8 text-sm" style={{ color: "var(--text-2)" }}>
          Paste a wallet address to see its position, loss, and share of the next cycle.
        </p>

        <div className="flex gap-3 max-w-xl">
          <input
            type="text"
            value={input}
            placeholder="wallet address"
            onChange={(e) => { setInput(e.target.value); setResult(null); }}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "var(--surface)",
              border: "1px solid var(--border-2)",
              borderRadius: "3px",
              color: "var(--text-1)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
              outline: "none",
            }}
            onFocus={(e)  => (e.target.style.borderColor = "var(--text-1)")}
            onBlur={(e)   => (e.target.style.borderColor = "var(--border-2)")}
          />
          <button
            onClick={lookup}
            disabled={loading || input.trim().length < 32}
            style={{
              padding: "10px 18px",
              background: "var(--text-1)",
              border: "1px solid var(--text-1)",
              borderRadius: "3px",
              color: "var(--surface)",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "11px",
              letterSpacing: "0.04em",
              cursor: loading ? "wait" : "pointer",
              opacity: loading || input.trim().length < 32 ? 0.35 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "checking" : "check"}
          </button>
        </div>

        {result === "not-found" && (
          <p
            className="mt-5 text-sm"
            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "12px", color: "var(--text-3)" }}
          >
            Not found. Wallet may not hold $RFND or has not been scanned yet.
          </p>
        )}

        {holder && rank !== null && (
          <div
            className="mt-6 max-w-xl space-y-5"
            style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}
          >
            {inTop20 ? (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-2)" }}
              >
                Position{" "}
                <span style={{ color: "var(--green)", fontFamily: "JetBrains Mono, monospace" }}>
                  #{rank}
                </span>
                {" "}in the queue. In the next refund cycle.
                {estimatedShare !== null && (
                  <>
                    {" "}Estimated share:{" "}
                    <span style={{ color: "var(--text-1)", fontFamily: "JetBrains Mono, monospace" }}>
                      ~{estimatedShare.toFixed(1)}% of the payout
                    </span>.
                  </>
                )}
              </p>
            ) : (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-2)" }}
              >
                Position{" "}
                <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--text-1)" }}>
                  #{rank}
                </span>
                . Outside the top 20.
                {solToTop !== null && solToTop > 0 && (
                  <>
                    {" "}Currently{" "}
                    <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--red)" }}>
                      {formatSol(solToTop, 3)} SOL
                    </span>
                    {" "}above the cutoff.
                  </>
                )}
              </p>
            )}

            <div
              className="grid grid-cols-3 gap-px"
              style={{ background: "var(--border)" }}
            >
              {[
                { label: "invested",      val: `${formatSol(holder.total_invested_sol, 3)} SOL`, red: false },
                { label: "current value", val: `${formatSol(holder.current_value_sol, 3)} SOL`,  red: false },
                { label: "down",          val: `${formatSol(Math.abs(holder.pnl_sol), 3)} SOL`,  red: true  },
              ].map(({ label, val, red }) => (
                <div
                  key={label}
                  className="py-4 px-4"
                  style={{ background: "var(--surface)" }}
                >
                  <div
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "9px",
                      color: "var(--text-3)",
                      letterSpacing: "0.07em",
                      marginBottom: "6px",
                    }}
                  >
                    {label.toUpperCase()}
                  </div>
                  <div
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: red ? "var(--red)" : "var(--text-2)",
                    }}
                  >
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
