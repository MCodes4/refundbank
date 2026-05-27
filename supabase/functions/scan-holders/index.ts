import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.87.6";

async function getActiveMint(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const force = Deno.env.get("FORCE_ACTIVE_MINT");
  if (force) return force;

  const { data } = await supabase
    .from("active_token")
    .select("mint_address")
    .eq("is_active", true)
    .single();

  return data?.mint_address ?? Deno.env.get("TOKEN_MINT_ADDRESS") ?? null;
}

interface HeliusTokenHolder {
  owner: string;
  balance: number;
}

interface HeliusTxTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  mint: string;
  tokenAmount: number;
  tokenStandard: string;
}

interface HeliusTx {
  signature: string;
  timestamp: number;
  type: string;
  tokenTransfers: HeliusTxTransfer[];
  nativeTransfers: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }>;
  events?: {
    swap?: {
      nativeInput?: { account: string; amount: number };
      nativeOutput?: { account: string; amount: number };
      tokenInputs?: Array<{ userAccount: string; mint: string; tokenAmount: number }>;
      tokenOutputs?: Array<{ userAccount: string; mint: string; tokenAmount: number }>;
    };
  };
}

async function getTokenPrice(mintAddress: string, heliusApiKey: string): Promise<number> {
  // Use Helius DAS to get current token price in SOL
  // Falls back to 0 if not available (devnet tokens have no real price)
  try {
    const res = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "price",
          method: "getAsset",
          params: { id: mintAddress },
        }),
      }
    );
    const data = await res.json();
    return data?.result?.token_info?.price_info?.price_per_token ?? 0;
  } catch {
    return 0;
  }
}

async function getAllTokenHolders(
  mintAddress: string,
  heliusApiKey: string
): Promise<HeliusTokenHolder[]> {
  const holders: HeliusTokenHolder[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `holders-${page}`,
        method: "getTokenAccounts",
        params: {
          mint: mintAddress,
          limit: 1000,
          page,
          options: { showZeroBalance: false },
        },
      }),
    });
    const data = await res.json();
    const accounts = data?.result?.token_accounts ?? [];
    if (accounts.length === 0) break;

    for (const acc of accounts) {
      holders.push({ owner: acc.owner, balance: acc.amount / 1e6 }); // pump.fun tokens use 6 decimals
    }
    if (accounts.length < 1000) break;
    page++;
  }

  return holders;
}

// Get buy history for a wallet via Helius enhanced transactions
async function getWalletBuyHistory(
  wallet: string,
  mintAddress: string,
  heliusApiKey: string
): Promise<{ totalInvestedSol: number; tokensBought: number }> {
  let totalInvestedSol = 0;
  let tokensBought = 0;

  try {
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${heliusApiKey}&type=SWAP&limit=100`,
      { headers: { "Content-Type": "application/json" } }
    );
    const txs: HeliusTx[] = await res.json();

    for (const tx of txs) {
      const swap = tx.events?.swap;
      if (!swap) continue;

      // User bought tokens (SOL in, token out)
      const boughtTokens = swap.tokenOutputs?.find(
        (t) => t.mint === mintAddress && t.userAccount === wallet
      );
      const soldSol = swap.nativeInput?.account === wallet ? swap.nativeInput.amount : 0;

      if (boughtTokens && soldSol > 0) {
        totalInvestedSol += soldSol / LAMPORTS_PER_SOL;
        tokensBought += boughtTokens.tokenAmount / 1e6;
      }

      // User sold tokens (token in, SOL out) — reduces net investment
      const soldTokens = swap.tokenInputs?.find(
        (t) => t.mint === mintAddress && t.userAccount === wallet
      );
      const receivedSol = swap.nativeOutput?.account === wallet ? swap.nativeOutput.amount : 0;

      if (soldTokens && receivedSol > 0) {
        totalInvestedSol -= receivedSol / LAMPORTS_PER_SOL;
        tokensBought -= soldTokens.tokenAmount / 1e6;
      }
    }
  } catch {
    // If tx history fetch fails, we skip PNL calc for this holder
  }

  return {
    totalInvestedSol: Math.max(0, totalInvestedSol),
    tokensBought: Math.max(0, tokensBought),
  };
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_KEY")!
    );

    const { data: killSwitch } = await supabase
      .from("config")
      .select("value")
      .eq("key", "kill_switch")
      .single();

    if (killSwitch?.value === "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "kill_switch active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const heliusApiKey = Deno.env.get("HELIUS_API_KEY")!;
    const network = Deno.env.get("SOLANA_NETWORK") ?? "devnet";

    const mintAddress = await getActiveMint(supabase);
    if (!mintAddress) {
      return new Response(JSON.stringify({ skipped: true, reason: "no active token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // On devnet tokens have no real price — use 0
    const pricePerTokenInSol = network === "mainnet" ? await getTokenPrice(mintAddress, heliusApiKey) : 0;

    const holders = await getAllTokenHolders(mintAddress, heliusApiKey);
    console.log(`Found ${holders.length} holders`);

    // Process in batches to avoid rate limits
    const BATCH_SIZE = 20;
    const upsertRows = [];

    for (let i = 0; i < holders.length; i += BATCH_SIZE) {
      const batch = holders.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (holder) => {
          const currentValueSol = holder.balance * pricePerTokenInSol;
          const { totalInvestedSol } = await getWalletBuyHistory(
            holder.owner,
            mintAddress,
            heliusApiKey
          );
          const pnlSol = currentValueSol - totalInvestedSol;
          const pnlPct = totalInvestedSol > 0 ? (pnlSol / totalInvestedSol) * 100 : null;

          return {
            wallet: holder.owner,
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

      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < holders.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Upsert all holders
    const { error } = await supabase
      .from("holders")
      .upsert(upsertRows, { onConflict: "wallet" });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, holders_updated: upsertRows.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scan-holders error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
