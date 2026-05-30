import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "https://esm.sh/@solana/web3.js@1.87.6";
import bs58 from "https://esm.sh/bs58@5.0.0";

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_KEY")!
    );

    // Kill-switch
    const { data: configs } = await supabase.from("config").select("key, value");
    const cfg = Object.fromEntries((configs ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));

    if (cfg["kill_switch"] === "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "kill_switch active" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const activeMint = await getActiveMint(supabase);
    if (!activeMint) {
      return new Response(JSON.stringify({ skipped: true, reason: "no active token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const minHolderValue   = parseFloat(cfg["min_holder_value_sol"]    ?? "0.05");
    const minInvested      = parseFloat(cfg["min_holder_invested_sol"] ?? "0.1");
    const maxPayoutPct     = parseFloat(cfg["max_single_payout_pct"]   ?? "0.05");
    const topCount         = parseInt(cfg["top_losers_count"]          ?? "20", 10);

    // Setup Solana
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL")!;
    const connection = new Connection(rpcUrl, "confirmed");
    const creatorKeypair = Keypair.fromSecretKey(
      bs58.decode(Deno.env.get("CREATOR_WALLET_PRIVATE_KEY")!)
    );

    const walletBalance = await connection.getBalance(creatorKeypair.publicKey);
    const walletBalanceSol = walletBalance / LAMPORTS_PER_SOL;

    // Sanity check: don't run if creator wallet is too low
    if (walletBalanceSol < 0.05) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `creator wallet too low: ${walletBalanceSol} SOL` }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch top losers for this mint only
    const { data: losers, error: losersErr } = await supabase
      .from("holders")
      .select("wallet, current_value_sol, total_invested_sol, pnl_sol")
      .eq("mint_address", activeMint)
      .lt("pnl_sol", 0)
      .gte("current_value_sol", minHolderValue)
      .gte("total_invested_sol", minInvested)
      .order("pnl_sol", { ascending: true })
      .limit(topCount);

    if (losersErr) throw losersErr;
    if (!losers || losers.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no qualifying holders" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get total fees available in DB (unclaimed distributions from this claim round)
    const body = await req.json().catch(() => ({}));
    const availableSol: number = body.amount_sol ?? 0;

    if (availableSol <= 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no SOL amount provided" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Treasury empty check
    if (availableSol < 0.01) {
      console.log("treasury empty, skipping");
      return new Response(
        JSON.stringify({ skipped: true, reason: "treasury empty, skipping" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Max single payout sanity check
    const maxPayout = walletBalanceSol * maxPayoutPct;
    if (availableSol > maxPayout) {
      console.warn(`Warning: distribute amount ${availableSol} SOL > ${maxPayoutPct * 100}% of wallet. Capping.`);
    }
    const distributeAmountSol = Math.min(availableSol, maxPayout);

    // Proportional allocation by absolute loss
    const totalAbsLoss = losers.reduce((sum: number, h: { pnl_sol: number }) => sum + Math.abs(h.pnl_sol), 0);

    type Allocation = { wallet: string; amountSol: number; amountLamports: number };
    const allocations: Allocation[] = losers
      .map((h: { wallet: string; pnl_sol: number }) => ({
        wallet: h.wallet,
        amountSol: (Math.abs(h.pnl_sol) / totalAbsLoss) * distributeAmountSol,
        amountLamports: Math.floor((Math.abs(h.pnl_sol) / totalAbsLoss) * distributeAmountSol * LAMPORTS_PER_SOL),
      }))
      .filter((a: Allocation) => a.amountLamports > 5000); // skip dust outputs (< 0.000005 SOL)

    if (allocations.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "all allocations below dust threshold" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build batch SOL transfer transaction
    // Solana has a limit of ~20 transfers per tx safely; split if needed
    const TX_BATCH_SIZE = 18;
    const results = [];

    for (let i = 0; i < allocations.length; i += TX_BATCH_SIZE) {
      const batch = allocations.slice(i, i + TX_BATCH_SIZE);
      const tx = new Transaction();

      for (const alloc of batch) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: creatorKeypair.publicKey,
            toPubkey: new PublicKey(alloc.wallet),
            lamports: alloc.amountLamports,
          })
        );
      }

      let signature: string | null = null;
      let status = "confirmed";

      try {
        signature = await sendAndConfirmTransaction(connection, tx, [creatorKeypair], {
          commitment: "confirmed",
        });
      } catch (txErr) {
        console.error("tx failed:", txErr);
        status = "failed";
      }

      // Log each recipient in DB
      const insertRows = batch.map((alloc) => ({
        recipient_wallet: alloc.wallet,
        amount_sol:       alloc.amountSol,
        tx_signature:     signature,
        status,
        mint_address:     activeMint,
      }));

      await supabase.from("distributions").insert(insertRows);
      results.push({ batch: i / TX_BATCH_SIZE + 1, signature, status, recipients: batch.length });
    }

    return new Response(
      JSON.stringify({ success: true, distributed_sol: distributeAmountSol, batches: results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("distribute error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
