"use client";

import { useEffect, useState } from "react";
import { supabase, type ActiveToken } from "@/lib/supabase";
import { formatSol } from "@/lib/format";

interface PreviousLaunch extends ActiveToken {
  total_paid_out?: number;
}

const COLS = [
  {
    heading: "Product",
    links: [
      { label: "The ledger",   href: "/ledger" },
      { label: "The queue",    href: "/ledger#queue" },
      { label: "How it works", href: "/how" },
      { label: "Check wallet", href: "/check" },
    ],
  },
  {
    heading: "Reach",
    links: [
      { label: "@refundbankfun", href: "https://x.com/refundbankfun", external: true },
      { label: "Dexscreener",    href: "https://dexscreener.com",      external: true },
      { label: "pump.fun",       href: "https://pump.fun",             external: true },
    ],
  },
];

export default function Footer({ activeMint }: { activeMint: string | null }) {
  const [prev, setPrev] = useState<PreviousLaunch[]>([]);

  useEffect(() => {
    supabase
      .from("active_token")
      .select("*")
      .eq("is_active", false)
      .order("activated_at", { ascending: false })
      .limit(10)
      .then(async ({ data }) => {
        if (!data?.length) return;
        const enriched = await Promise.all(
          data.map(async (t) => {
            const { data: dists } = await supabase
              .from("distributions")
              .select("amount_sol")
              .eq("mint_address", t.mint_address)
              .eq("status", "confirmed");
            const total = (dists ?? []).reduce((s: number, d: any) => s + d.amount_sol, 0);
            return { ...t, total_paid_out: total } as PreviousLaunch;
          })
        );
        setPrev(enriched);
      });
  }, []);

  return (
    <footer style={{ borderTop: "1px solid var(--border)" }}>
      <div className="px-6 sm:px-8 pt-12 pb-10">
        <div className="grid sm:grid-cols-3 gap-10 mb-12">
          <div className="space-y-4">
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "13px",
                color: "var(--text-1)",
              }}
            >
              refundbank.
            </p>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-2)", maxWidth: "240px" }}
            >
              Creator fees on every trade, redistributed every two minutes to the
              wallets deepest in loss. On chain. Automatic.
            </p>
            {activeMint && (
              <a
                href={`https://solscan.io/account/${activeMint}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize:   "10px",
                  color:      "var(--text-3)",
                  textDecoration: "none",
                  display:    "block",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
              >
                {activeMint.slice(0, 8)}...{activeMint.slice(-6)} ↗
              </a>
            )}
          </div>

          {COLS.map((col) => (
            <div key={col.heading} className="space-y-4">
              <p
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "9px",
                  color: "var(--text-3)",
                  letterSpacing: "0.1em",
                }}
              >
                {col.heading.toUpperCase()}
              </p>
              <div className="space-y-3">
                {col.links.map(({ label, href, ...rest }) => {
                  const external = "external" in rest ? rest.external : false;
                  return (
                    <a
                      key={label}
                      href={href}
                      target={external ? "_blank" : undefined}
                      rel={external ? "noopener noreferrer" : undefined}
                      className="block text-sm transition-colors duration-150"
                      style={{
                        color: "var(--text-3)",
                        fontFamily: "Inter, sans-serif",
                        textDecoration: "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-1)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {prev.length > 0 && (
          <div className="mb-10">
            <p
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize:   "9px",
                color:      "var(--text-3)",
                letterSpacing: "0.1em",
                marginBottom: "1rem",
              }}
            >
              PREVIOUS LAUNCHES
            </p>
            <div className="space-y-2">
              {prev.map((t) => (
                <div key={t.mint_address} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        fontSize:   "12px",
                        color:      "var(--text-2)",
                      }}
                    >
                      {t.symbol ? `$${t.symbol}` : t.mint_address.slice(0, 8) + "..."}
                      {t.name && (
                        <span style={{ color: "var(--text-3)", marginLeft: "6px" }}>
                          {t.name}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {t.total_paid_out !== undefined && t.total_paid_out > 0 && (
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize:   "11px",
                          color:      "var(--text-3)",
                        }}
                      >
                        {formatSol(t.total_paid_out, 3)} SOL refunded
                      </span>
                    )}
                    {t.pump_fun_url && (
                      <a
                        href={t.pump_fun_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize:   "10px",
                          color:      "var(--text-3)",
                          textDecoration: "none",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                      >
                        pump.fun ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-8"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <p
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "10px",
              color: "var(--text-3)",
            }}
          >
            refundbank v0.1 · Solana devnet · 2026
          </p>
          <p
            className="text-right max-w-sm"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              color: "var(--text-3)",
            }}
          >
            Refunds depend on trading volume. Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
