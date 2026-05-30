"use client";

import { useEffect, useState } from "react";
import { supabase, type Distribution, type FeeClaim } from "@/lib/supabase";
import { useActiveToken } from "@/hooks/useActiveToken";

import Header    from "@/components/Header";
import VaultStats from "@/components/VaultStats";
import Footer    from "@/components/Footer";

export default function VaultPage() {
  const { token, loading: tokenLoading } = useActiveToken();
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [feeClaims,     setFeeClaims]     = useState<FeeClaim[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    const mint = token?.mint_address ?? null;

    async function load() {
      const distQ = mint
        ? supabase.from("distributions").select("*").eq("mint_address", mint).order("distributed_at", { ascending: false }).limit(200)
        : supabase.from("distributions").select("*").order("distributed_at", { ascending: false }).limit(200);

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
      .channel("vault-page-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "distributions" }, (p) => {
        const d = p.new as Distribution;
        if (token?.mint_address && d.mint_address && d.mint_address !== token.mint_address) return;
        setDistributions((prev) => [d, ...prev]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fee_claims" }, (p) => {
        const c = p.new as FeeClaim;
        if (token?.mint_address && c.mint_address && c.mint_address !== token.mint_address) return;
        setFeeClaims((prev) => [c, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [token?.mint_address]);

  const totalPaidOut     = distributions.filter((d) => d.status === "confirmed").reduce((s, d) => s + d.amount_sol, 0);
  const totalClaimed     = feeClaims.reduce((s, c) => s + c.amount_sol, 0);
  const inVaultSol       = Math.max(0, totalClaimed - totalPaidOut);
  const walletsRefunded  = new Set(distributions.filter((d) => d.status === "confirmed").map((d) => d.recipient_wallet)).size;
  const cyclesDispatched = distributions.filter((d) => d.status === "confirmed").length;

  return (
    <>
      <Header token={token} />
      <main className="max-w-5xl mx-auto">
        <div
          className="px-6 sm:px-8 pt-32 pb-10"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "10px",
              color: "var(--text-3)",
              letterSpacing: "0.1em",
              marginBottom: "12px",
            }}
          >
            PAYBACK / VAULT
          </p>
          <h1
            className="text-4xl sm:text-6xl font-medium"
            style={{
              fontFamily: "Newsreader, serif",
              letterSpacing: "-0.03em",
              color: "var(--text-1)",
              maxWidth: "600px",
            }}
          >
            The vault.
          </h1>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--text-2)", maxWidth: "480px", lineHeight: 1.7 }}
          >
            Live balances, lifetime totals, and distribution history.
            Updated in real time as trades happen.
          </p>
        </div>

        <VaultStats
          inVaultSol={inVaultSol}
          paidOutSol={totalPaidOut}
          walletsRefunded={walletsRefunded}
          cyclesDispatched={cyclesDispatched}
          loading={loading}
        />

        <Footer activeMint={token?.mint_address ?? null} />
      </main>
    </>
  );
}
