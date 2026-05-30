import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// No web3.js needed — all Solana data comes from Helius HTTP API.
const LAMPORTS_PER_SOL = 1_000_000_000;

const serviceKey = () =>
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_KEY") ||
  Deno.env.get("SERVICE_KEY") || "";

async function getActiveMint(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const force = Deno.env.get("FORCE_ACTIVE_MINT");
  if (force) return force;
  const { data } = await supabase
    .from("active_token").select("mint_address").eq("is_active", true).single();
  return data?.mint_address ?? Deno.env.get("TOKEN_MINT_ADDRESS") ?? null;
}

async function getTokenPrice(mintAddress: string, heliusApiKey: string): Promise<number> {
  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "price", method: "getAsset", params: { id: mintAddress } }),
    });
    const data = await res.json();
    return data?.result?.token_info?.price_info?.price_per_token ?? 0;
  } catch { return 0; }
}

async function getAllTokenHolders(mintAddress: string, heliusApiKey: string) {
  const holders: Array<{ owner: string; balance: number }> = [];
  let page = 1;
  while (true) {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: `holders-${page}`, method: "getTokenAccounts",
        params: { mint: mintAddress, limit: 1000, page, options: { showZeroBalance: false } },
      }),
    });
    const data = await res.json();
    const accounts = data?.result?.token_accounts ?? [];
    if (accounts.length === 0) break;
    for (const acc of accounts) holders.push({ owner: acc.owner, balance: acc.amount / 1e6 });
    if (accounts.length < 1000) break;
    page++;
  }
  return holders;
}

async function getWalletBuyHistory(wallet: string, mintAddress: string, heliusApiKey: string) {
  let totalInvestedSol = 0;
  let tokensBought = 0;
  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${heliusApiKey}&type=SWAP&limit=100`,
      { headers: { "Content-Type": "application/json" } }
    );
    const txs: any[] = await res.json();
    for (const tx of txs) {
      const swap = tx.events?.swap;
      if (!swap) continue;
      const boughtTokens = swap.tokenOutputs?.find((t: any) => t.mint === mintAddress && t.userAccount === wallet);
      const soldSol = swap.nativeInput?.account === wallet ? swap.nativeInput.amount : 0;
      if (boughtTokens && soldSol > 0) {
        totalInvestedSol += soldSol / LAMPORTS_PER_SOL;
        tokensBought += boughtTokens.tokenAmount / 1e6;
      }
      const soldTokens = swap.tokenInputs?.find((t: any) => t.mint === mintAddress && t.userAccount === wallet);
      const receivedSol = swap.nativeOutput?.account === wallet ? swap.nativeOutput.amount : 0;
      if (soldTokens && receivedSol > 0) {
        totalInvestedSol -= receivedSol / LAMPORTS_PER_SOL;
        tokensBought -= soldTokens.tokenAmount / 1e6;
      }
    }
  } catch { /* skip */ }
  return { totalInvestedSol: Math.max(0, totalInvestedSol), tokensBought: Math.max(0, tokensBought) };
}

serve(async () => {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey());

    const { data: killSwitch } = await supabase.from("config").select("value").eq("key", "kill_switch").single();
    if (killSwitch?.value === "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "kill_switch active" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const heliusApiKey = Deno.env.get("HELIUS_API_KEY") || "";
    const network      = Deno.env.get("SOLANA_NETWORK") || "mainnet";

    const mintAddress = await getActiveMint(supabase);
    if (!mintAddress) {
      return new Response(JSON.stringify({ skipped: true, reason: "no active token" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const pricePerTokenInSol = network === "mainnet" ? await getTokenPrice(mintAddress, heliusApiKey) : 0;
    const holders = await getAllTokenHolders(mintAddress, heliusApiKey);
    console.log(`Found ${holders.length} holders`);

    const BATCH_SIZE = 20;
    const upsertRows = [];

    for (let i = 0; i < holders.length; i += BATCH_SIZE) {
      const batch = holders.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (holder) => {
          const currentValueSol = holder.balance * pricePerTokenInSol;
          const { totalInvestedSol } = await getWalletBuyHistory(holder.owner, mintAddress, heliusApiKey);
          const pnlSol = currentValueSol - totalInvestedSol;
          const pnlPct = totalInvestedSol > 0 ? (pnlSol / totalInvestedSol) * 100 : null;
          return {
            wallet: holder.owner,
            mint_address: mintAddress,
            token_balance: holder.balance,
            total_invested_sol: totalInvestedSol,
            current_value_sol: currentValueSol,
            pnl_sol: pnlSol,
            pnl_pct: pnlPct,
            last_updated: new Date().toISOString(),
          };
        })
      );
      upsertRows.push(...batchResults);
      if (i + BATCH_SIZE < holders.length) await new Promise((r) => setTimeout(r, 500));
    }

    const { error } = await supabase.from("holders").upsert(upsertRows, { onConflict: "wallet,mint_address" });
    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, holders_updated: upsertRows.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scan-holders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
