"use client";

import { useEffect, useState } from "react";
import { supabase, type Holder, type Distribution, type FeeClaim } from "@/lib/supabase";
import { useActiveToken } from "@/hooks/useActiveToken";

import Header               from "@/components/Header";
import HeroSection          from "@/components/HeroSection";
import TickerTape           from "@/components/TickerTape";
import VaultStats           from "@/components/VaultStats";
import DistributionsSection from "@/components/DistributionsSection";
import HoldersSection       from "@/components/HoldersSection";
import HowItWorks           from "@/components/HowItWorks";
import WhyThisExists        from "@/components/WhyThisExists";
import CheckWallet          from "@/components/CheckWallet";
import FinalCTA             from "@/components/FinalCTA";
import Footer               from "@/components/Footer";
import NewLaunchBanner      from "@/components/NewLaunchBanner";

export default function Home() {
  const { token, loading: tokenLoading, newLaunch, clearNewLaunch } = useActiveToken();

  const [holders,       setHolders]       = useState<Holder[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [feeClaims,     setFeeClaims]     = useState<FeeClaim[]>([]);
  const [loading,       setLoading]       = useState(true);

  // Reload all data when the active token changes
  useEffect(() => {
    setLoading(true);
    setHolders([]);
    setDistributions([]);
    setFeeClaims([]);

    const mint = token?.mint_address ?? null;

    async function load() {
      const holderQ = supabase
        .from("holders")
        .select("*")
        .lt("pnl_sol", 0)
        .order("pnl_sol", { ascending: true })
        .limit(100);

      // Filter dist/claims by mint if we have one (null rows = legacy, still show)
      const distQ = mint
        ? supabase
            .from("distributions")
            .select("*")
            .eq("mint_address", mint)
            .order("distributed_at", { ascending: false })
            .limit(50)
        : supabase
            .from("distributions")
            .select("*")
            .order("distributed_at", { ascending: false })
            .limit(50);

      const claimQ = mint
        ? supabase
            .from("fee_claims")
            .select("*")
            .eq("mint_address", mint)
            .order("claimed_at", { ascending: false })
        : supabase
            .from("fee_claims")
            .select("*")
            .order("claimed_at", { ascending: false });

      const [hRes, dRes, cRes] = await Promise.all([holderQ, distQ, claimQ]);
      if (hRes.data) setHolders(hRes.data);
      if (dRes.data) setDistributions(dRes.data);
      if (cRes.data) setFeeClaims(cRes.data);
      setLoading(false);
    }

    if (!tokenLoading) load();
  }, [token?.mint_address, tokenLoading]);

  // Realtime subscriptions
  useEffect(() => {
    const ch = supabase
      .channel("refundbank-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "distributions" }, (p) => {
        const d = p.new as Distribution;
        if (token?.mint_address && d.mint_address && d.mint_address !== token.mint_address) return;
        setDistributions((prev) => [d, ...prev].slice(0, 50));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fee_claims" }, (p) => {
        const c = p.new as FeeClaim;
        if (token?.mint_address && c.mint_address && c.mint_address !== token.mint_address) return;
        setFeeClaims((prev) => [c, ...prev]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "holders" }, () => {
        supabase
          .from("holders")
          .select("*")
          .lt("pnl_sol", 0)
          .order("pnl_sol", { ascending: true })
          .limit(100)
          .then(({ data }) => { if (data) setHolders(data); });
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [token?.mint_address]);

  const totalPaidOut     = distributions.filter((d) => d.status === "confirmed").reduce((s, d) => s + d.amount_sol, 0);
  const totalClaimed     = feeClaims.reduce((s, c) => s + c.amount_sol, 0);
  const inVaultSol       = Math.max(0, totalClaimed - totalPaidOut);
  const walletsRefunded  = new Set(distributions.filter((d) => d.status === "confirmed").map((d) => d.recipient_wallet)).size;
  const cyclesDispatched = distributions.filter((d) => d.status === "confirmed").length;
  const lastRefundAt     = distributions[0]?.distributed_at ?? null;

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

        <VaultStats
          inVaultSol={inVaultSol}
          paidOutSol={totalPaidOut}
          walletsRefunded={walletsRefunded}
          cyclesDispatched={cyclesDispatched}
          loading={loading}
        />

        <DistributionsSection
          distributions={distributions}
          loading={loading}
        />

        <HoldersSection
          holders={holders.slice(0, 20)}
          loading={loading}
        />

        <HowItWorks />

        <WhyThisExists />

        <CheckWallet allHolders={holders} />

        <FinalCTA />

        <Footer activeMint={token?.mint_address ?? null} />
      </main>
    </>
  );
}
