"use client";

import { useRef, useEffect, useState } from "react";
import { type Distribution } from "@/lib/supabase";
import { shortWallet, formatSol, SOLSCAN_TX, SOLSCAN_WALLET } from "@/lib/format";
import { useInView } from "@/hooks/useInView";

interface Props {
  distributions: Distribution[];
  loading: boolean;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Countdown() {
  const [secs, setSecs] = useState<number | null>(null);

  useEffect(() => {
    function calc() {
      const now = Math.floor(Date.now() / 1000);
      return 120 - (now % 120);
    }
    setSecs(calc());
    const id = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  if (secs === null) return null;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "9px",
          color: "var(--text-3)",
          letterSpacing: "0.08em",
        }}
      >
        NEXT DROP IN
      </span>
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: "16px",
          fontWeight: 500,
          color: secs <= 30 ? "var(--green)" : "var(--text-1)",
          letterSpacing: "-0.02em",
        }}
      >
        {mm}:{ss}
      </span>
    </div>
  );
}

export default function DistributionsSection({ distributions, loading }: Props) {
  const { ref, inView } = useInView();
  const prevLenRef = useRef(distributions.length);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (distributions.length > prevLenRef.current) {
      const fresh = distributions
        .slice(0, distributions.length - prevLenRef.current)
        .map((d) => d.id);
      setNewIds((prev) => new Set([...prev, ...fresh]));
      const t = setTimeout(() => setNewIds(new Set()), 30000);
      return () => clearTimeout(t);
    }
    prevLenRef.current = distributions.length;
  }, [distributions]);

  return (
    <section
      id="ledger"
      ref={ref}
      className={`reveal ${inView ? "visible" : ""}`}
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="px-6 sm:px-8 pt-8 pb-4 flex items-start justify-between gap-4">
        <div>
          <h2
            className="section-label text-xl font-medium"
            style={{ fontFamily: "Newsreader, serif", letterSpacing: "-0.02em" }}
          >
            The ledger.
          </h2>
          <p className="mt-2 text-sm" style={{ color: "var(--text-2)" }}>
            Every drop, on-chain, in order. Updated every two minutes.
          </p>
        </div>
        <div className="pt-1">
          <Countdown />
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="px-6 sm:px-8 py-4 flex items-center justify-between gap-4"
              style={{ borderBottom: "1px solid var(--border)", opacity: Math.max(0.15, 1 - i * 0.12) }}
            >
              <span className="skeleton h-4 w-32" />
              <span className="skeleton h-4 w-20" />
            </div>
          ))
        ) : distributions.length === 0 ? (
          <div
            className="px-6 sm:px-8 py-12"
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "12px",
              color: "var(--text-3)",
            }}
          >
            No drops yet. The first drop is coming.
          </div>
        ) : (
          distributions.slice(0, 24).map((d) => {
            const isNew = newIds.has(d.id);
            return (
              <div
                key={d.id}
                className="px-6 sm:px-8 py-4 flex items-start justify-between gap-4"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "10px",
                      color: "var(--green)",
                      opacity: 0.7,
                      marginTop: "1px",
                      flexShrink: 0,
                    }}
                  >
                    ↗
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isNew && (
                        <span
                          style={{
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: "9px",
                            color: "var(--green)",
                            border: "1px solid rgba(22,163,74,0.3)",
                            borderRadius: "3px",
                            padding: "1px 5px",
                            letterSpacing: "0.06em",
                          }}
                        >
                          NEW
                        </span>
                      )}
                      <a
                        href={SOLSCAN_WALLET(d.recipient_wallet)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: "13px",
                          color: "var(--text-2)",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
                      >
                        {shortWallet(d.recipient_wallet)}
                      </a>
                    </div>
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "10px",
                        color: "var(--text-3)",
                        display: "block",
                        marginTop: "3px",
                      }}
                    >
                      {timeAgo(d.distributed_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "14px",
                      fontWeight: 500,
                      color: "var(--green)",
                    }}
                  >
                    +{formatSol(d.amount_sol, 4)} SOL
                  </span>
                  {d.tx_signature ? (
                    <a
                      href={SOLSCAN_TX(d.tx_signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "10px",
                        color: "var(--text-3)",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                    >
                      tx ↗
                    </a>
                  ) : (
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize: "10px",
                        color: d.status === "failed" ? "var(--red)" : "var(--text-3)",
                      }}
                    >
                      {d.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {distributions.length > 24 && (
        <div
          className="px-6 sm:px-8 py-3"
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "10px",
            color: "var(--text-3)",
            borderTop: "1px solid var(--border)",
          }}
        >
          Showing 24 of {distributions.length} drops
        </div>
      )}
    </section>
  );
}
