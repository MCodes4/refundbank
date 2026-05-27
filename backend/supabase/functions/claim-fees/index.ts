import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "https://esm.sh/@solana/web3.js@1.87.6";
import bs58 from "https://esm.sh/bs58@5.0.0";

const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

// Discriminator for pump.fun `collect_creator_fee` instruction
// Derived from sha256("global:collect_creator_fee")[0..8]
const COLLECT_CREATOR_FEE_DISCRIMINATOR = Buffer.from([
  0xa9, 0x26, 0x6e, 0x89, 0x4e, 0x8b, 0x4d, 0x9c,
]);

function getCreatorFeeAccount(mint: PublicKey, creator: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-fee"), mint.toBuffer(), creator.toBuffer()],
    PUMP_PROGRAM_ID
  );
  return pda;
}

function getBondingCurve(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMP_PROGRAM_ID
  );
  return pda;
}

serve(async (req) => {
  try {
    // Kill-switch check
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

    const rpcUrl = Deno.env.get("SOLANA_RPC_URL")!;
    const connection = new Connection(rpcUrl, "confirmed");

    const privateKeyB58 = Deno.env.get("CREATOR_WALLET_PRIVATE_KEY")!;
    const creatorKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyB58));

    const mintAddress = Deno.env.get("TOKEN_MINT_ADDRESS")!;
    const mint = new PublicKey(mintAddress);

    const creatorFeeAccount = getCreatorFeeAccount(mint, creatorKeypair.publicKey);
    const bondingCurve = getBondingCurve(mint);

    // Check claimable balance
    const feeAccountInfo = await connection.getAccountInfo(creatorFeeAccount);
    if (!feeAccountInfo || feeAccountInfo.lamports === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no fees to claim" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const claimableLamports = feeAccountInfo.lamports;
    const claimableSOL = claimableLamports / LAMPORTS_PER_SOL;

    // Build claim instruction
    const claimIx = new TransactionInstruction({
      programId: PUMP_PROGRAM_ID,
      keys: [
        { pubkey: creatorKeypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: creatorFeeAccount,        isSigner: false, isWritable: true },
        { pubkey: bondingCurve,             isSigner: false, isWritable: true },
        { pubkey: mint,                     isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
      ],
      data: COLLECT_CREATOR_FEE_DISCRIMINATOR,
    });

    const tx = new Transaction().add(claimIx);
    const signature = await sendAndConfirmTransaction(connection, tx, [creatorKeypair], {
      commitment: "confirmed",
    });

    // Log to DB
    await supabase.from("fee_claims").insert({
      amount_sol: claimableSOL,
      tx_signature: signature,
    });

    // Trigger distribute function asynchronously
    const distributeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/distribute`;
    fetch(distributeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "fee_claim", amount_sol: claimableSOL }),
    }).catch(() => {}); // fire-and-forget

    return new Response(
      JSON.stringify({ success: true, claimed_sol: claimableSOL, signature }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("claim-fees error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
