import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Keypair, PublicKey } from "https://esm.sh/@solana/web3.js@1.87.6";
import bs58 from "https://esm.sh/bs58@5.0.0";

const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCreatorWallet(): string {
  const explicit = Deno.env.get("CREATOR_WALLET_ADDRESS");
  if (explicit) return explicit;
  const privateKey = Deno.env.get("CREATOR_WALLET_PRIVATE_KEY")!;
  return Keypair.fromSecretKey(bs58.decode(privateKey)).publicKey.toBase58();
}

function pumpFunUrl(mint: string)     { return `https://pump.fun/coin/${mint}`; }
function dexscreenerUrl(mint: string) { return `https://dexscreener.com/solana/${mint}`; }

async function fetchTokenMetadata(
  mint: string,
  rpcUrl: string,
): Promise<{ name: string | null; symbol: string | null }> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: "meta", method: "getAsset", params: { id: mint },
      }),
    });
    const data = await res.json();
    return {
      name:   data?.result?.content?.metadata?.name   ?? null,
      symbol: data?.result?.content?.metadata?.symbol ?? null,
    };
  } catch {
    return { name: null, symbol: null };
  }
}

// ─── Detection strategy 1: Helius DAS getAssetsByCreator ─────────────────────
// Works on mainnet. pump.fun writes Metaplex metadata with the launcher wallet
// as verified creator. Returns newest fungible token first.

async function detectViaCreatorDAS(
  creatorWallet: string,
  rpcUrl: string,
): Promise<Array<{ mint: string; name: string | null; symbol: string | null }>> {
  try {
    const res = await fetch(rpcUrl, {
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
          limit: 50,
          sortBy: { sortBy: "created", sortDirection: "desc" },
        },
      }),
    });
    const data = await res.json();
    const items: any[] = data?.result?.items ?? [];

    // Keep only fungible tokens (not NFTs)
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
    console.log("DAS getAssetsByCreator failed:", err);
    return [];
  }
}

// ─── Detection strategy 2: Transaction history scan ──────────────────────────
// Works on both mainnet and devnet.
// A pump.fun `create` transaction:
//   - is signed by the creator wallet
//   - invokes the pump.fun program
//   - mints a large initial supply to the bonding curve (fromUserAccount === null
//     in the Helius enhanced token transfer, meaning fresh mint)

async function detectViaTxHistory(
  creatorWallet: string,
  heliusApiKey: string,
  network: string,
): Promise<Array<{ mint: string; timestamp: number }>> {
  try {
    const apiBase = network === "mainnet"
      ? "https://api.helius.xyz"
      : "https://api-devnet.helius.xyz";

    const res = await fetch(
      `${apiBase}/v0/addresses/${creatorWallet}/transactions?api-key=${heliusApiKey}&limit=50`,
    );
    if (!res.ok) return [];
    const txs: any[] = await res.json();
    if (!Array.isArray(txs)) return [];

    const found: Array<{ mint: string; timestamp: number }> = [];

    for (const tx of txs) {
      // Must involve the pump.fun program
      const accountData: any[] = tx.accountData ?? [];
      const hasPump = accountData.some(
        (a) => a.account === PUMP_PROGRAM_ID,
      );
      if (!hasPump) continue;

      // Look for fresh mints (fromUserAccount null = initial supply minted)
      const transfers: any[] = tx.tokenTransfers ?? [];
      for (const t of transfers) {
        if (t.fromUserAccount === null && t.mint && t.tokenAmount > 0) {
          found.push({ mint: t.mint, timestamp: tx.timestamp ?? 0 });
        }
      }
    }

    // Deduplicate and sort newest first
    const seen = new Set<string>();
    return found
      .filter((f) => { if (seen.has(f.mint)) return false; seen.add(f.mint); return true; })
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.log("tx history scan failed:", err);
    return [];
  }
}

// ─── Activate a token in the DB ───────────────────────────────────────────────

async function activateToken(
  supabase: ReturnType<typeof createClient>,
  mint: string,
  name: string | null,
  symbol: string | null,
  creatorWallet: string,
  launchedAt: string | null,
) {
  // 1. Deactivate all current active tokens
  await supabase
    .from("active_token")
    .update({ is_active: false })
    .eq("is_active", true);

  // 2. Clear stale holder data (it's per-token; rescan will repopulate)
  await supabase.from("holders").delete().neq("wallet", "__never__");

  // 3. Upsert new active token
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

// ─── Main ──────────────────────────────────────────────────────────────────────

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_KEY")!,
    );

    // Kill-switch
    const { data: ks } = await supabase
      .from("config").select("value").eq("key", "kill_switch").single();
    if (ks?.value === "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "kill_switch active" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const heliusApiKey = Deno.env.get("HELIUS_API_KEY")!;
    const network      = Deno.env.get("SOLANA_NETWORK") ?? "devnet";
    const rpcUrl       = Deno.env.get("SOLANA_RPC_URL")!;
    const creatorWallet = getCreatorWallet();

    // ── FORCE_ACTIVE_MINT override (useful for devnet testing) ──────────────
    const forceMint = Deno.env.get("FORCE_ACTIVE_MINT");
    if (forceMint) {
      // Check if already active
      const { data: current } = await supabase
        .from("active_token").select("mint_address").eq("is_active", true).single();
      if (current?.mint_address === forceMint) {
        return new Response(JSON.stringify({ status: "no_change", active_mint: forceMint }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      }
      const meta = await fetchTokenMetadata(forceMint, rpcUrl);
      await activateToken(supabase, forceMint, meta.name, meta.symbol, creatorWallet, null);
      triggerScanHolders(supabase);
      return new Response(JSON.stringify({ activated: forceMint, method: "force_override" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // ── Load current active token ───────────────────────────────────────────
    const { data: currentActive } = await supabase
      .from("active_token")
      .select("mint_address, activated_at")
      .eq("is_active", true)
      .single();

    // ── Detect newest pump.fun token from this creator ──────────────────────
    let candidates: Array<{ mint: string; name?: string | null; symbol?: string | null; timestamp?: number }> = [];

    // Strategy 1: DAS (mainnet)
    if (network === "mainnet") {
      const dasResults = await detectViaCreatorDAS(creatorWallet, rpcUrl);
      candidates = dasResults.map((d) => ({ mint: d.mint, name: d.name, symbol: d.symbol }));
    }

    // Strategy 2: tx history fallback (devnet or if DAS returned nothing)
    if (candidates.length === 0) {
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

    // Already active — nothing to do
    if (currentActive?.mint_address === newest.mint) {
      return new Response(
        JSON.stringify({ status: "no_change", active_mint: newest.mint }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // ── New token detected — switch to it ──────────────────────────────────
    let { name, symbol } = newest as { name?: string | null; symbol?: string | null };

    // Fetch metadata if detection didn't return it
    if (!name && !symbol) {
      const meta = await fetchTokenMetadata(newest.mint, rpcUrl);
      name   = meta.name;
      symbol = meta.symbol;
    }

    const launchedAt = newest.timestamp
      ? new Date(newest.timestamp * 1000).toISOString()
      : null;

    await activateToken(supabase, newest.mint, name ?? null, symbol ?? null, creatorWallet, launchedAt);
    triggerScanHolders(supabase);

    console.log(`New token activated: ${symbol ?? newest.mint} (${newest.mint})`);

    return new Response(
      JSON.stringify({
        activated:  newest.mint,
        name:       name ?? null,
        symbol:     symbol ?? null,
        previous:   currentActive?.mint_address ?? null,
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

function triggerScanHolders(supabase: ReturnType<typeof createClient>) {
  const scanUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/scan-holders`;
  fetch(scanUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  }).catch(() => {});
}
