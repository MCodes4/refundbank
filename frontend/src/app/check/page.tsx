"use client";

import { useEffect, useState } from "react";
import { supabase, type Holder } from "@/lib/supabase";
import { useActiveToken } from "@/hooks/useActiveToken";

import Header      from "@/components/Header";
import CheckWallet from "@/components/CheckWallet";
import Footer      from "@/components/Footer";

export default function CheckPage() {
  const { token, loading: tokenLoading } = useActiveToken();
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    async function load() {
      const { data } = await supabase
        .from("holders")
        .select("*")
        .lt("pnl_sol", 0)
        .order("pnl_sol", { ascending: true })
        .limit(100);
      if (data) setHolders(data);
      setLoading(false);
    }

    if (!tokenLoading) load();
  }, [tokenLoading]);

  useEffect(() => {
    const ch = supabase
      .channel("check-page-live")
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
  }, []);

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
            PAYBAG / CHECK
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
            Are you in line?
          </h1>
          <p
            className="mt-4 text-sm"
            style={{ color: "var(--text-2)", maxWidth: "480px", lineHeight: 1.7 }}
          >
            Paste a wallet address to see its position in the paybag queue,
            total loss, and estimated share of the next cycle.
          </p>
        </div>

        {loading ? (
          <div
            className="px-6 sm:px-8 py-16"
            style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "11px", color: "var(--text-3)" }}
          >
            Loading holder data...
          </div>
        ) : (
          <CheckWallet allHolders={holders} />
        )}

        <Footer activeMint={token?.mint_address ?? null} />
      </main>
    </>
  );
}
