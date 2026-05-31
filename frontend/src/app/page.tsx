"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, type Distribution, type FeeClaim } from "@/lib/supabase";
import { useActiveToken } from "@/hooks/useActiveToken";

import Header          from "@/components/Header";
import HeroSection     from "@/components/HeroSection";
import TickerTape      from "@/components/TickerTape";
import FinalCTA        from "@/components/FinalCTA";
import Footer          from "@/components/Footer";
import NewLaunchBanner from "@/components/NewLaunchBanner";

const PAGES = [
  {
    href:  "/ledger",
    label: "Ledger",
    tag:   "LIVE",
    desc:  "Every payout dispatched, on-chain, in order. The queue shows the twenty wallets receiving the next cycle.",
  },
  {
    href:  "/vault",
    label: "Vault",
    tag:   "STATS",
    desc:  "How much SOL is in the bank right now, lifetime paid out, wallets refunded, and cycles dispatched.",
  },
  {
    href:  "/how",
    label: "Docs",
    tag:   "MECHANICS",
    desc:  "The three-event cycle. Volume happens, holders are ranked, the treasury empties. Every two minutes.",
  },
  {
    href:  "/check",
    label: "Check wallet",
    tag:   "LOOKUP",
    desc:  "Paste any wallet address. See its queue position, total loss, and estimated share of the next payout.",
  },
];

export default function Home() {
  const { token, loading: tokenLoading, newLaunch, clearNewLaunch } = useActiveToken();

  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [feeClaims,     setFeeClaims]     = useState<FeeClaim[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    const mint = token?.mint_address ?? null;

    async function load() {
      const distQ = mint
        ? supabase.from("distributions").select("*").eq("mint_address", mint).order("distributed_at", { ascending: false }).limit(50)
        : supabase.from("distributions").select("*").order("distributed_at", { ascending: false }).limit(50);

      const claimQ = mint
        ? supabase.from("fee_claims").select("*").eq("mint_address", mint).order("claimed_at", { ascending: false })
        : supabase.from("fee_claims").select("*").order("claimed_at", { ascending: false });

      const [dRes, cRes] = await Promise.all([distQ, claimQ]);
      if (dRes.data) setDistributions(dRes.data);
      if (cRes.data) setFeeClaims(cRes.data);
      setLoading(false);
    }

    if (!tokenLoading) load();
  }, [token?.mint_address, tokenLoading]);

  useEffect(() => {
    const ch = supabase
      .channel("home-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "distributions" }, (p) => {
        const d = p.new as Distribution;
        if (token?.mint_address && d.mint_address && d.mint_address !== token.mint_address) return;
        setDistributions((prev) => [d, ...prev].slice(0, 50));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [token?.mint_address]);

  const totalPaidOut = distributions.filter((d) => d.status === "confirmed").reduce((s, d) => s + d.amount_sol, 0);
  const totalClaimed = feeClaims.reduce((s, c) => s + c.amount_sol, 0);
  const inVaultSol   = Math.max(0, totalClaimed - totalPaidOut);
  const walletsRefunded  = new Set(distributions.filter((d) => d.status === "confirmed").map((d) => d.recipient_wallet)).size;
  const cyclesDispatched = distributions.filter((d) => d.status === "confirmed").length;
  const lastRefundAt     = distributions[0]?.distributed_at ?? null;

  const stats = [
    { label: "In vault",       val: inVaultSol.toFixed(3),             suffix: "SOL" },
    { label: "Paid out",       val: totalPaidOut.toFixed(3),           suffix: "SOL" },
    { label: "Paid",           val: walletsRefunded.toLocaleString(),   suffix: ""    },
    { label: "Cycles",         val: cyclesDispatched.toLocaleString(),  suffix: ""    },
  ];

  return (
    <>
      <Header token={token} />

      {newLaunch && (
        <NewLaunchBanner token={newLaunch} onDismiss={clearNewLaunch} />
      )}

      <main className="max-w-5xl mx-auto">
        <div className="px-6 sm:px-8">
          <HeroSection lastRefundAt={lastRefundAt} token={token} />
        </div>

        <TickerTape distributions={distributions} />

        {/* Mini stats */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0"
          style={{
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
            borderColor: "var(--border)",
          } as React.CSSProperties}
        >
          {stats.map(({ label, val, suffix }) => (
            <div
              key={label}
              className="px-6 sm:px-8 py-6 flex flex-col gap-1.5"
            >
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "9px",
                  color: "var(--text-3)",
                  letterSpacing: "0.1em",
                }}
              >
                {label.toUpperCase()}
              </span>
              {loading ? (
                <span className="skeleton h-7 w-16" />
              ) : (
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "22px",
                    fontWeight: 500,
                    color: "var(--text-1)",
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                  }}
                >
                  {val}
                  {suffix && (
                    <span style={{ fontSize: "12px", color: "var(--text-2)", marginLeft: "4px" }}>
                      {suffix}
                    </span>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Navigation grid */}
        <div
          className="grid sm:grid-cols-2"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          {PAGES.map(({ href, label, tag, desc }, i) => (
            <Link
              key={href}
              href={href}
              className="block px-6 sm:px-8 py-8 group"
              style={{
                textDecoration: "none",
                borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none",
                borderTop: i >= 2 ? "1px solid var(--border)" : "1px solid var(--border)",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div className="flex items-baseline justify-between mb-3">
                <span
                  style={{
                    fontFamily: "Newsreader, serif",
                    fontSize: "20px",
                    letterSpacing: "-0.02em",
                    color: "var(--text-1)",
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "8px",
                    color: "var(--text-3)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {tag}
                </span>
              </div>
              <p
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: "13px",
                  color: "var(--text-2)",
                  lineHeight: 1.7,
                  maxWidth: "280px",
                }}
              >
                {desc}
              </p>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "12px",
                  color: "var(--text-3)",
                  marginTop: "14px",
                  display: "block",
                }}
              >
                →
              </span>
            </Link>
          ))}
        </div>

        <FinalCTA />
        <Footer activeMint={token?.mint_address ?? null} />
      </main>
    </>
  );
}
