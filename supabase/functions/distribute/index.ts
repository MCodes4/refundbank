import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bs58 from "https://esm.sh/bs58@5.0.0";

const LAMPORTS_PER_SOL     = 1_000_000_000;
const SYSTEM_PROGRAM_BYTES = new Uint8Array(32); // 111...1 = all zeros

const getServiceKey = () =>
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_KEY") ??
  Deno.env.get("SERVICE_KEY") ?? "";

async function getActiveMint(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const force = Deno.env.get("FORCE_ACTIVE_MINT");
  if (force) return force;
  const { data } = await supabase.from("active_token").select("mint_address").eq("is_active", true).single();
  return data?.mint_address ?? Deno.env.get("TOKEN_MINT_ADDRESS") ?? null;
}

function cat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Solana compact-u16 encoding
function cu16(n: number): Uint8Array {
  if (n <= 0x7f) return new Uint8Array([n]);
  if (n <= 0x3fff) return new Uint8Array([n & 0x7f | 0x80, n >> 7]);
  return new Uint8Array([(n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, n >> 14]);
}

// u64 little-endian (for SOL transfer instruction)
function u64LE(n: number): Uint8Array {
  const buf = new Uint8Array(8);
  let v = BigInt(Math.round(n));
  for (let i = 0; i < 8; i++) { buf[i] = Number(v & 0xffn); v >>= 8n; }
  return buf;
}

async function rpc<T>(url: string, method: string, params: unknown): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${method}: ${j.error.message ?? JSON.stringify(j.error)}`);
  return j.result as T;
}

async function buildAndSendTransfers(
  rpcUrl: string,
  seed: Uint8Array,
  senderPub: Uint8Array,
  transfers: Array<{ recipientPub: Uint8Array; lamports: number }>,
): Promise<string> {
  type BhResult = { value: { blockhash: string } };
  const bh = await rpc<BhResult>(rpcUrl, "getLatestBlockhash", [{ commitment: "confirmed" }]);
  const blockhash = bs58.decode(bh.value.blockhash);

  // Account order:
  //   [0]        sender          (writable, signer)
  //   [1..N]     recipients      (writable, non-signer)
  //   [N+1]      SystemProgram   (readonly, non-signer)
  const accounts = [senderPub, ...transfers.map(t => t.recipientPub), SYSTEM_PROGRAM_BYTES];
  const sysIdx   = accounts.length - 1;

  // Header: 1 required sig, 0 readonly-signed, 1 readonly-unsigned (SystemProgram)
  const header = new Uint8Array([1, 0, 1]);

  // Instructions: one SystemProgram::Transfer per recipient
  // data = [2, 0, 0, 0] (transfer discriminant) + lamports u64 LE
  const ixParts: Uint8Array[] = [cu16(transfers.length)];
  for (let i = 0; i < transfers.length; i++) {
    const data = cat(new Uint8Array([2, 0, 0, 0]), u64LE(transfers[i].lamports));
    ixParts.push(
      new Uint8Array([sysIdx]),
      cu16(2),
      new Uint8Array([0, i + 1]),
      cu16(data.length),
      data,
    );
  }

  const message = cat(
    header,
    cu16(accounts.length),
    ...accounts,
    blockhash,
    ...ixParts,
  );

  const pkcs8  = new Uint8Array([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20,...seed]);
  const sigKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  const sig    = new Uint8Array(await crypto.subtle.sign("Ed25519", sigKey, message));
  const tx     = cat(new Uint8Array([1]), sig, message);
  const txB64  = btoa(String.fromCharCode(...tx));

  return rpc<string>(rpcUrl, "sendTransaction", [
    txB64,
    { encoding: "base64", preflightCommitment: "confirmed" },
  ]);
}

serve(async (req) => {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, getServiceKey());

    const { data: configs } = await supabase.from("config").select("key, value");
    const cfg = Object.fromEntries((configs ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));

    if (cfg["kill_switch"] === "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "kill_switch active" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const activeMint = await getActiveMint(supabase);
    if (!activeMint) {
      return new Response(JSON.stringify({ skipped: true, reason: "no active token" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const minHolderValue = parseFloat(cfg["min_holder_value_sol"]    ?? "0.001");
    const minInvested    = parseFloat(cfg["min_holder_invested_sol"] ?? "0.001");
    const maxPayoutPct   = parseFloat(cfg["max_single_payout_pct"]   ?? "0.05");
    const topCount       = parseInt(cfg["top_losers_count"]          ?? "20", 10);

    const rpcUrl  = Deno.env.get("SOLANA_RPC_URL")!;
    const kpBytes = bs58.decode(Deno.env.get("CREATOR_WALLET_PRIVATE_KEY")!);
    if (kpBytes.length !== 64) throw new Error("Expected 64-byte keypair");
    const seed      = kpBytes.slice(0, 32);
    const senderPub = kpBytes.slice(32, 64);

    type BalResult = { value: number };
    const balResult = await rpc<BalResult>(rpcUrl, "getBalance", [bs58.encode(senderPub)]);
    const walletBalanceSol = balResult.value / LAMPORTS_PER_SOL;

    if (walletBalanceSol < 0.005) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `creator wallet too low: ${walletBalanceSol} SOL` }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data: losers, error: losersErr } = await supabase
      .from("holders")
      .select("wallet, current_value_sol, total_invested_sol, pnl_sol, token_balance")
      .eq("mint_address", activeMint)
      .lt("pnl_sol", 0)
      .gte("current_value_sol", minHolderValue)
      .gte("total_invested_sol", minInvested)
      .order("pnl_sol", { ascending: true })
      .limit(topCount);

    if (losersErr) throw losersErr;

    // Fallback: if no PnL data yet, distribute proportionally by token balance
    let recipients: Array<{ wallet: string; weight: number }>;
    let mode: string;

    if (!losers || losers.length === 0) {
      const { data: allHolders, error: allErr } = await supabase
        .from("holders")
        .select("wallet, token_balance")
        .eq("mint_address", activeMint)
        .gt("token_balance", 0);
      if (allErr) throw allErr;
      if (!allHolders || allHolders.length === 0) {
        return new Response(
          JSON.stringify({ skipped: true, reason: "no holders found" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      recipients = allHolders.map((h: { wallet: string; token_balance: number }) => ({
        wallet: h.wallet,
        weight: h.token_balance,
      }));
      mode = "proportional_balance";
    } else {
      recipients = losers.map((h: { wallet: string; pnl_sol: number }) => ({
        wallet: h.wallet,
        weight: Math.abs(h.pnl_sol),
      }));
      mode = "pnl_weighted";
    }

    const body = await req.json().catch(() => ({}));
    const availableSol: number = body.amount_sol ?? 0;

    if (availableSol <= 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no SOL amount provided" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }


    const maxPayout           = walletBalanceSol * maxPayoutPct;
    const distributeAmountSol = Math.min(availableSol, maxPayout);
    const totalWeight         = recipients.reduce((s, r) => s + r.weight, 0);

    type Alloc = { wallet: string; recipientPub: Uint8Array; amountSol: number; amountLamports: number };
    const allocations: Alloc[] = recipients
      .map((r) => ({
        wallet:         r.wallet,
        recipientPub:   bs58.decode(r.wallet),
        amountSol:      (r.weight / totalWeight) * distributeAmountSol,
        amountLamports: Math.floor((r.weight / totalWeight) * distributeAmountSol * LAMPORTS_PER_SOL),
      }))
      .filter((a: Alloc) => a.amountLamports > 5000);

    if (allocations.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "all allocations below dust threshold" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const TX_BATCH_SIZE = 18;
    const results = [];

    for (let i = 0; i < allocations.length; i += TX_BATCH_SIZE) {
      const batch = allocations.slice(i, i + TX_BATCH_SIZE);
      let signature: string | null = null;
      let status = "confirmed";

      try {
        signature = await buildAndSendTransfers(
          rpcUrl, seed, senderPub,
          batch.map(a => ({ recipientPub: a.recipientPub, lamports: a.amountLamports })),
        );
      } catch (txErr) {
        console.error("tx failed:", txErr);
        status = "failed";
      }

      const { error: insertErr } = await supabase.from("distributions").insert(
        batch.map(a => ({
          recipient_wallet: a.wallet,
          amount_sol:       a.amountSol,
          tx_signature:     signature,
          status,
          mint_address:     activeMint,
        }))
      );
      if (insertErr) console.error("insert error:", JSON.stringify(insertErr));
      results.push({ batch: i / TX_BATCH_SIZE + 1, signature, status, recipients: batch.length, insertErr: insertErr?.message ?? null });
    }

    return new Response(
      JSON.stringify({ success: true, distributed_sol: distributeAmountSol, mode, batches: results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("distribute error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
