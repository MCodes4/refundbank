import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// No @solana/web3.js — creator wallet public key read directly from CREATOR_WALLET_ADDRESS secret.

const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

function serviceKey(): string {
  return (
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_KEY") ||
    Deno.env.get("SERVICE_KEY") ||
    ""
  );
}

function pumpFunUrl(mint: string)     { return `https://pump.fun/coin/${mint}`; }
function dexscreenerUrl(mint: string) { return `https://dexscreener.com/solana/${mint}`; }

// Fetch with a manual timeout via AbortController (compatible with all Deno versions)
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTokenMetadata(
  mint: string,
  rpcUrl: string,
): Promise<{ name: string | null; symbol: string | null }> {
  try {
    const res = await fetchWithTimeout(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "meta", method: "getAsset", params: { id: mint } }),
    }, 4000);
    const data = await res.json();
    return {
      name:   data?.result?.content?.metadata?.name   ?? null,
      symbol: data?.result?.content?.metadata?.symbol ?? null,
    };
  } catch {
    return { name: null, symbol: null };
  }
}

// Strategy 1: Helius DAS getAssetsByCreator
async function detectViaCreatorDAS(
  creatorWallet: string,
  rpcUrl: string,
): Promise<Array<{ mint: string; name: string | null; symbol: string | null }>> {
  try {
    const res = await fetchWithTimeout(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "byCreator",
        method: "getAssetsByCreator",
        params: {
          creatorAddress: creatorWallet,
          onlyVerified: false,
          page: 1,
          limit: 5,
          sortBy: { sortBy: "created", sortDirection: "desc" },
        },
      }),
    }, 4000);
    const data = await res.json();
    const items: any[] = data?.result?.items ?? [];
    return items
      .filter((a: any) =>
        a.interface === "FungibleToken" ||
        a.interface === "FungibleAsset" ||
        (a.token_info && !a.grouping?.length)
      )
      .map((a: any) => ({
        mint:   a.id,
        name:   a.content?.metadata?.name   ?? null,
        symbol: a.content?.metadata?.symbol ?? null,
      }));
  } catch (err) {
    console.log("DAS failed:", err);
    return [];
  }
}

// Strategy 2: Helius tx history scan
async function detectViaTxHistory(
  creatorWallet: string,
  heliusApiKey: string,
  network: string,
): Promise<Array<{ mint: string; timestamp: number }>> {
  try {
    const base = network === "mainnet" ? "https://api.helius.xyz" : "https://api-devnet.helius.xyz";
    const res = await fetchWithTimeout(
      `${base}/v0/addresses/${creatorWallet}/transactions?api-key=${heliusApiKey}&limit=15`,
      {},
      4000,
    );
    if (!res.ok) return [];
    const txs: any[] = await res.json();
    if (!Array.isArray(txs)) return [];

    const found: Array<{ mint: string; timestamp: number }> = [];
    for (const tx of txs) {
      const hasPump = (tx.accountData ?? []).some((a: any) => a.account === PUMP_PROGRAM_ID);
      if (!hasPump) continue;
      for (const t of (tx.tokenTransfers ?? [])) {
        if (t.fromUserAccount === null && t.mint && t.tokenAmount > 0) {
          found.push({ mint: t.mint, timestamp: tx.timestamp ?? 0 });
        }
      }
    }

    const seen = new Set<string>();
    return found
      .filter((f) => { if (seen.has(f.mint)) return false; seen.add(f.mint); return true; })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.log("tx history failed:", err);
    return [];
  }
}

async function activateToken(
  supabase: ReturnType<typeof createClient>,
  mint: string,
  name: string | null,
  symbol: string | null,
  creatorWallet: string,
  launchedAt: string | null,
) {
  await supabase.from("active_token").update({ is_active: false }).eq("is_active", true);
  await supabase.from("holders").delete().neq("wallet", "__never__");
  const { error } = await supabase.from("active_token").upsert(
    {
      mint_address:    mint,
      name,
      symbol,
      is_active:       true,
      activated_at:    new Date().toISOString(),
      launched_at:     launchedAt,
      creator_wallet:  creatorWallet,
      pump_fun_url:    pumpFunUrl(mint),
      dexscreener_url: dexscreenerUrl(mint),
    },
    { onConflict: "mint_address" },
  );
  if (error) throw error;
}

function triggerScanHolders() {
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/scan-holders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  }).catch(() => {});
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey(),
    );

    const { data: ks } = await supabase
      .from("config").select("value").eq("key", "kill_switch").single();
    if (ks?.value === "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "kill_switch active" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const heliusApiKey  = Deno.env.get("HELIUS_API_KEY") || "";
    const network       = Deno.env.get("SOLANA_NETWORK") || "mainnet";
    const rpcUrl        = Deno.env.get("SOLANA_RPC_URL") || "";
    const creatorWallet = Deno.env.get("CREATOR_WALLET_ADDRESS") || "";

    if (!creatorWallet) {
      return new Response(JSON.stringify({ error: "CREATOR_WALLET_ADDRESS not set" }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    const forceMint = Deno.env.get("FORCE_ACTIVE_MINT");
    if (forceMint) {
      const { data: current } = await supabase
        .from("active_token").select("mint_address").eq("is_active", true).single();
      if (current?.mint_address === forceMint) {
        return new Response(JSON.stringify({ status: "no_change", active_mint: forceMint }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      const meta = await fetchTokenMetadata(forceMint, rpcUrl);
      await activateToken(supabase, forceMint, meta.name, meta.symbol, creatorWallet, null);
      triggerScanHolders();
      return new Response(JSON.stringify({ activated: forceMint, method: "force_override" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const { data: currentActive } = await supabase
      .from("active_token").select("mint_address").eq("is_active", true).single();

    let candidates: Array<{ mint: string; name?: string | null; symbol?: string | null; timestamp?: number }> = [];

    if (network === "mainnet" && rpcUrl) {
      const dasResults = await detectViaCreatorDAS(creatorWallet, rpcUrl);
      candidates = dasResults.map((d) => ({ mint: d.mint, name: d.name, symbol: d.symbol }));
    }

    if (candidates.length === 0 && heliusApiKey) {
      const txResults = await detectViaTxHistory(creatorWallet, heliusApiKey, network);
      candidates = txResults.map((r) => ({ mint: r.mint, timestamp: r.timestamp }));
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ status: "no_tokens_found", creator: creatorWallet }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const newest = candidates[0];

    if (currentActive?.mint_address === newest.mint) {
      return new Response(
        JSON.stringify({ status: "no_change", active_mint: newest.mint }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    let name   = newest.name   ?? null;
    let symbol = newest.symbol ?? null;
    if (!name && !symbol && rpcUrl) {
      const meta = await fetchTokenMetadata(newest.mint, rpcUrl);
      name   = meta.name;
      symbol = meta.symbol;
    }

    const launchedAt = newest.timestamp
      ? new Date((newest.timestamp as number) * 1000).toISOString()
      : null;

    await activateToken(supabase, newest.mint, name, symbol, creatorWallet, launchedAt);
    triggerScanHolders();

    console.log(`Activated: ${symbol ?? newest.mint}`);

    return new Response(
      JSON.stringify({
        activated: newest.mint,
        name,
        symbol,
        previous: currentActive?.mint_address ?? null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("detect-new-launch error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
