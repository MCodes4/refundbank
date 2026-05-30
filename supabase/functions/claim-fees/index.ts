import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bs58 from "https://esm.sh/bs58@5.0.0";

const LAMPORTS_PER_SOL      = 1_000_000_000;
const PUMP_PROGRAM_BYTES    = bs58.decode("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const WSOL_MINT_BYTES       = bs58.decode("So11111111111111111111111111111111111111112");
const TOKEN_PROGRAM_BYTES   = bs58.decode("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM_BYTES     = bs58.decode("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM_PROGRAM_BYTES  = new Uint8Array(32);
// Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1 = pump.fun event authority (constant)
const EVENT_AUTHORITY_BYTES = bs58.decode("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");
// collect_creator_fee_v2 discriminator = sha256("global:collect_creator_fee_v2")[0:8]
const COLLECT_FEE_DISC_V2   = new Uint8Array([0xcf, 0x11, 0x8a, 0xf2, 0x04, 0x22, 0x13, 0x38]);
const PUMP_PROGRAM_ID       = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

const getServiceKey = () =>
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_KEY") ??
  Deno.env.get("SERVICE_KEY") ?? "";

function cat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function cu16(n: number): Uint8Array {
  if (n <= 0x7f) return new Uint8Array([n]);
  if (n <= 0x3fff) return new Uint8Array([n & 0x7f | 0x80, n >> 7]);
  return new Uint8Array([(n & 0x7f) | 0x80, ((n >> 7) & 0x7f) | 0x80, n >> 14]);
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

const FIELD_P = 2n ** 255n - 19n;
const ED25519_D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;

function modpow(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n; b %= m;
  while (e > 0n) { if (e & 1n) r = r * b % m; e >>= 1n; b = b * b % m; }
  return r;
}

function isOnEd25519Curve(bytes: Uint8Array): boolean {
  const b = new Uint8Array(bytes);
  b[31] &= 0x7f;
  let y = 0n;
  // little-endian: b[i] contributes b[i] * 256^i
  for (let i = 31; i >= 0; i--) y = y * 256n + BigInt(b[i]);
  if (y >= FIELD_P) return false;
  const y2 = y * y % FIELD_P;
  const u  = (y2 - 1n + FIELD_P) % FIELD_P;
  const v  = (ED25519_D * y2 % FIELD_P + 1n) % FIELD_P;
  if (u === 0n) return true;
  const v3 = v * v % FIELD_P * v % FIELD_P;
  const v7 = v3 * v3 % FIELD_P * v % FIELD_P;
  const x  = u * v3 % FIELD_P * modpow(u * v7 % FIELD_P, (FIELD_P - 5n) / 8n, FIELD_P) % FIELD_P;
  if (x * x % FIELD_P * v % FIELD_P === u) return true;
  const x2 = x * modpow(2n, (FIELD_P - 1n) / 4n, FIELD_P) % FIELD_P;
  return x2 * x2 % FIELD_P * v % FIELD_P === u;
}

async function findPda(seeds: Uint8Array[], programId: Uint8Array): Promise<Uint8Array> {
  const marker = new TextEncoder().encode("ProgramDerivedAddress");
  for (let nonce = 255; nonce >= 0; nonce--) {
    const hash = await sha256(cat(...seeds, new Uint8Array([nonce]), programId, marker));
    if (!isOnEd25519Curve(hash)) return hash;
  }
  throw new Error("Could not find valid PDA nonce");
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

async function getActiveMint(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const force = Deno.env.get("FORCE_ACTIVE_MINT");
  if (force) return force;
  const { data } = await supabase.from("active_token").select("mint_address").eq("is_active", true).single();
  return data?.mint_address ?? Deno.env.get("TOKEN_MINT_ADDRESS") ?? null;
}

// Find and cache the creator fee vault address from on-chain buy transactions.
// The creator fee vault is always at account index 9 of the pump.fun BUY instruction.
async function getOrDiscoverFeeVault(
  supabase: ReturnType<typeof createClient>,
  mintAddr: string,
  mintPub: Uint8Array,
  rpcUrl: string,
): Promise<string | null> {
  const { data: tokenData } = await supabase
    .from("active_token")
    .select("creator_fee_account")
    .eq("mint_address", mintAddr)
    .single();

  if (tokenData?.creator_fee_account) return tokenData.creator_fee_account;

  // Derive bonding curve PDA to scan its transactions
  const bondingCurve = await findPda(
    [new TextEncoder().encode("bonding-curve"), mintPub],
    PUMP_PROGRAM_BYTES,
  );
  const bondingCurveB58 = bs58.encode(bondingCurve);

  type SigsResult = Array<{ signature: string }>;
  const sigs = await rpc<SigsResult>(rpcUrl, "getSignaturesForAddress", [bondingCurveB58, { limit: 10 }])
    .catch(() => [] as SigsResult);

  for (const { signature } of sigs) {
    try {
      const tx = await rpc<any>(rpcUrl, "getTransaction", [
        signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
      ]);
      if (!tx) continue;

      const extractFeeVault = (instructions: any[]): string | null => {
        for (const ix of instructions ?? []) {
          if (ix.programId === PUMP_PROGRAM_ID && (ix.accounts?.length ?? 0) >= 10) {
            if (ix.accounts[3] === bondingCurveB58) return ix.accounts[9];
          }
        }
        return null;
      };

      let feeVault =
        extractFeeVault(tx.transaction?.message?.instructions) ??
        null;

      if (!feeVault) {
        for (const innerGroup of tx.meta?.innerInstructions ?? []) {
          feeVault = extractFeeVault(innerGroup.instructions);
          if (feeVault) break;
        }
      }

      if (feeVault) {
        await supabase.from("active_token")
          .update({ creator_fee_account: feeVault })
          .eq("mint_address", mintAddr);
        return feeVault;
      }
    } catch { continue; }
  }

  return null;
}

serve(async (_req) => {
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, getServiceKey());

    const { data: ks } = await supabase.from("config").select("value").eq("key", "kill_switch").single();
    if (ks?.value === "true") {
      return new Response(JSON.stringify({ skipped: true, reason: "kill_switch active" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const rpcUrl   = Deno.env.get("SOLANA_RPC_URL")!;
    const mintAddr = await getActiveMint(supabase);
    if (!mintAddr) {
      return new Response(JSON.stringify({ skipped: true, reason: "no active token" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const kpBytes    = bs58.decode(Deno.env.get("CREATOR_WALLET_PRIVATE_KEY")!);
    if (kpBytes.length !== 64) throw new Error("Expected 64-byte Solana keypair");
    const seed       = kpBytes.slice(0, 32);
    const creatorPub = kpBytes.slice(32, 64);
    const mintPub    = bs58.decode(mintAddr);

    // Get or discover the creator fee vault address
    const feeVaultB58 = await getOrDiscoverFeeVault(supabase, mintAddr, mintPub, rpcUrl);
    if (!feeVaultB58) {
      return new Response(JSON.stringify({ skipped: true, reason: "fee vault not found (no buys yet?)" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const feeVault = bs58.decode(feeVaultB58);

    // Check claimable balance
    type AccInfo = { value: { lamports: number } | null };
    const feeInfo = await rpc<AccInfo>(rpcUrl, "getAccountInfo", [feeVaultB58, { encoding: "base64" }]);
    if (!feeInfo?.value || feeInfo.value.lamports === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no fees to claim" }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    const claimableSOL = feeInfo.value.lamports / LAMPORTS_PER_SOL;

    // Derive wSOL ATAs
    // creatorWSolATA = ATA(creator, wSOL)  — needed by pump.fun collect instruction
    // feeVaultWSolATA = ATA(feeVault, wSOL) — needed by pump.fun collect instruction
    const creatorWSolATA  = await findPda([creatorPub, TOKEN_PROGRAM_BYTES, WSOL_MINT_BYTES], ATA_PROGRAM_BYTES);
    const feeVaultWSolATA = await findPda([feeVault,   TOKEN_PROGRAM_BYTES, WSOL_MINT_BYTES], ATA_PROGRAM_BYTES);

    // Get recent blockhash
    type BhResult = { value: { blockhash: string } };
    const bh = await rpc<BhResult>(rpcUrl, "getLatestBlockhash", [{ commitment: "confirmed" }]);
    const blockhash = bs58.decode(bh.value.blockhash);

    // Build collect_creator_fee_v2 transaction
    // Account order (header [1, 0, 6]):
    //   [0] creator          (writable, signer)
    //   [1] creatorWSolATA   (writable)
    //   [2] feeVault         (writable)
    //   [3] feeVaultWSolATA  (writable)
    //   [4] wSOL mint        (readonly)
    //   [5] Token Program    (readonly)
    //   [6] AToken Program   (readonly)
    //   [7] System Program   (readonly)
    //   [8] event authority  (readonly)
    //   [9] pump program     (readonly + programId)
    const accounts = [
      creatorPub, creatorWSolATA, feeVault, feeVaultWSolATA,
      WSOL_MINT_BYTES, TOKEN_PROGRAM_BYTES, ATA_PROGRAM_BYTES, SYSTEM_PROGRAM_BYTES,
      EVENT_AUTHORITY_BYTES, PUMP_PROGRAM_BYTES,
    ];

    const message = cat(
      new Uint8Array([1, 0, 6]),   // header: 1 signer, 0 readonly-signed, 6 readonly-unsigned
      cu16(accounts.length),
      ...accounts,
      blockhash,
      cu16(1),                     // 1 instruction
      new Uint8Array([9]),          // programIdIndex = 9 (pump program)
      cu16(10),                    // 10 account indices
      new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]),
      cu16(COLLECT_FEE_DISC_V2.length),
      COLLECT_FEE_DISC_V2,
    );

    const pkcs8  = new Uint8Array([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20,...seed]);
    const sigKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
    const sig    = new Uint8Array(await crypto.subtle.sign("Ed25519", sigKey, message));
    const txBytes  = cat(new Uint8Array([1]), sig, message);
    const txBase64 = btoa(String.fromCharCode(...txBytes));

    const signature = await rpc<string>(rpcUrl, "sendTransaction", [
      txBase64,
      { encoding: "base64", preflightCommitment: "confirmed" },
    ]);

    await supabase.from("fee_claims").insert({
      amount_sol:   claimableSOL,
      tx_signature: signature,
      mint_address: mintAddr,
    });

    fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/distribute`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getServiceKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "fee_claim", amount_sol: claimableSOL }),
    }).catch(() => {});

    return new Response(
      JSON.stringify({ success: true, claimed_sol: claimableSOL, signature }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("claim-fees error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
