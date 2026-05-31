"use client";

import { useEffect, useState } from "react";
import { supabase, type Distribution, type Holder } from "@/lib/supabase";
import { useActiveToken } from "@/hooks/useActiveToken";

import Header              from "@/components/Header";
import TickerTape          from "@/components/TickerTape";
import DistributionsSection from "@/components/DistributionsSection";
import HoldersSection      from "@/components/HoldersSection";
import Footer              from "@/components/Footer";

export default function LedgerPage() {
  const { token, loading: tokenLoading } = useActiveToken();
  const [holders,       setHolders]       = useState<Holder[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    setHolders([]);
    setDistributions([]);

    const mint = token?.mint_address ?? null;

    async function load() {
      const holderQ = supabase
        .from("holders")
        .select("*")
        .lt("pnl_sol", 0)
        .order("pnl_sol", { ascending: true })
        .limit(100);

      const distQ = mint
        ? supabase.from("distributions").select("*").eq("mint_address", mint).order("distributed_at", { ascending: false }).limit(50)
        : supabase.from("distributions").select("*").order("distributed_at", { ascending: false }).limit(50);

      const [hRes, dRes] = await Promise.all([holderQ, distQ]);
      if (hRes.data) setHolders(hRes.data);
      if (dRes.data) setDistributions(dRes.data);
      setLoading(false);
    }

    if (!tokenLoading) load();
  }, [token?.mint_address, tokenLoading]);

  useEffect(() => {
    const ch = supabase
      .channel("ledger-page-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "distributions" }, (p) => {
        const d = p.new as Distribution;
        if (token?.mint_address && d.mint_address && d.mint_address !== token.mint_address) return;
        setDistributions((prev) => [d, ...prev].slice(0, 50));
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
            PAYBAG / LEDGER
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
            The ledger.
          </h1>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--text-2)", maxWidth: "480px", lineHeight: 1.7 }}
          >
            Every paybag dispatched, on-chain, in order.
            The queue shows who receives the next cycle.
          </p>
        </div>

        <TickerTape distributions={distributions} />
        <DistributionsSection distributions={distributions} loading={loading} />
        <HoldersSection holders={holders.slice(0, 20)} loading={loading} />
        <Footer activeMint={token?.mint_address ?? null} />
      </main>
    </>
  );
}
