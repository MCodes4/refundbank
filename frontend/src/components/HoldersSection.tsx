"use client";

import { type Holder } from "@/lib/supabase";
import { shortWallet, formatSol, SOLSCAN_WALLET } from "@/lib/format";
import { useInView } from "@/hooks/useInView";

interface Props {
  holders: Holder[];
  loading: boolean;
}

export default function HoldersSection({ holders, loading }: Props) {
  const { ref, inView } = useInView();

  const totalLoss = holders.reduce((s, h) => s + Math.abs(h.pnl_sol), 0);

  return (
    <section
      id="queue"
      ref={ref}
      className={`reveal ${inView ? "visible" : ""}`}
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="px-6 sm:px-8 pt-8 pb-4">
        <h2
          className="section-label text-xl font-medium"
          style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
        >
          The queue.
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--text-2)" }}>
          The twenty wallets deepest in the red. Next drop pays these, in proportion.
        </p>
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }}>
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="px-6 sm:px-8 py-4"
              style={{ borderBottom: "1px solid var(--border)", opacity: Math.max(0.15, 1 - i * 0.1) }}
            >
              <div className="flex items-center justify-between gap-4 mb-3">
                <span className="skeleton h-4 w-28" />
                <span className="skeleton h-4 w-20" />
              </div>
              <span className="skeleton h-1.5 w-full block rounded-full" />
            </div>
          ))
        ) : holders.length === 0 ? (
          <div
            className="px-6 sm:px-8 py-12"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
              color: "var(--text-3)",
            }}
          >
            Queue is empty. Waiting for first holder scan.
          </div>
        ) : (
          holders.map((h, i) => {
            const share = totalLoss > 0 ? (Math.abs(h.pnl_sol) / totalLoss) * 100 : 0;
            const isTop = i === 0;

            return (
              <div
                key={h.wallet}
                className="px-6 sm:px-8 py-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: isTop ? "14px" : "11px",
                        color: isTop ? "var(--text-1)" : "var(--text-3)",
                        fontWeight: isTop ? 500 : 400,
                        flexShrink: 0,
                        width: "1.5rem",
                        textAlign: "right",
                      }}
                    >
                      {i + 1}
                    </span>
                    <a
                      href={SOLSCAN_WALLET(h.wallet)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "12px",
                        color: "var(--text-2)",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
                    >
                      {shortWallet(h.wallet)}
                    </a>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <div
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "9px",
                          color: "var(--text-3)",
                          letterSpacing: "0.06em",
                        }}
                      >
                        INVESTED
                      </div>
                      <div
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "12px",
                          color: "var(--text-2)",
                        }}
                      >
                        {formatSol(h.total_invested_sol, 3)} SOL
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "9px",
                          color: "var(--text-3)",
                          letterSpacing: "0.06em",
                        }}
                      >
                        DOWN
                      </div>
                      <div
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--red)",
                        }}
                      >
                        {formatSol(Math.abs(h.pnl_sol), 3)} SOL
                      </div>
                    </div>
                    <div className="text-right" style={{ minWidth: "3.5rem" }}>
                      <div
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "9px",
                          color: "var(--text-3)",
                          letterSpacing: "0.06em",
                        }}
                      >
                        SHARE
                      </div>
                      <div
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "12px",
                          color: "var(--text-1)",
                          opacity: 0.8,
                        }}
                      >
                        {share.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 ml-9">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, share)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
