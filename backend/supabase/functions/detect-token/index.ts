import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Connection,
  Keypair,
  PublicKey,
} from "https://esm.sh/@solana/web3.js@1.87.6";
import bs58 from "https://esm.sh/bs58@5.0.0";

const PUMP_PROGRAM_ID  = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

function getCreatorFeeAccount(mint: PublicKey, creator: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator-fee"), mint.toBuffer(), creator.toBuffer()],
    PUMP_PROGRAM_ID
  );
  return pda;
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_KEY")!
    );

    const connection  = new Connection(Deno.env.get("SOLANA_RPC_URL")!, "confirmed");
    const creatorKeypair = Keypair.fromSecretKey(
      bs58.decode(Deno.env.get("CREATOR_WALLET_PRIVATE_KEY")!)
    );

    // Get current active mint from DB
    const { data: activeRow } = await supabase
      .from("active_token")
      .select("mint_address")
      .eq("is_active", true)
      .single();

    const currentMint = activeRow?.mint_address ?? null;

    // Scan last 15 transactions from creator wallet
    const sigs = await connection.getSignaturesForAddress(
      creatorKeypair.publicKey,
      { limit: 15 }
    );

    for (const sigInfo of sigs) {
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (!tx) continue;

      // Only look at transactions involving the pump.fun program
      const accountKeys = tx.transaction.message.accountKeys;
      const hasPump = accountKeys.some(
        (k) => k.pubkey.toBase58() === PUMP_PROGRAM_ID.toBase58()
      );
      if (!hasPump) continue;

      const preBalances  = tx.meta?.preBalances  ?? [];
      const postBalances = tx.meta?.postBalances ?? [];

      // Check each account that was newly created in this transaction
      for (let i = 0; i < accountKeys.length; i++) {
        if ((preBalances[i] ?? 0) > 0) continue;  // existed before
        if ((postBalances[i] ?? 0) === 0) continue; // still empty

        const candidate = accountKeys[i].pubkey.toBase58();
        if (candidate === currentMint) continue; // already tracking this

        try {
          const info = await connection.getAccountInfo(new PublicKey(candidate));
          if (!info) continue;
          // SPL mint accounts: owned by Token program, exactly 82 bytes
          if (info.owner.toBase58() !== TOKEN_PROGRAM_ID) continue;
          if (info.data.length !== 82) continue;

          // Confirm it's our token by checking the creator-fee PDA exists
          const feeAccount = getCreatorFeeAccount(
            new PublicKey(candidate),
            creatorKeypair.publicKey
          );
          const feeInfo = await connection.getAccountInfo(feeAccount);
          if (!feeInfo) continue;

          // Try to fetch name/symbol from Helius DAS
          let symbol: string | null = null;
          let name:   string | null = null;
          try {
            const heliusKey = Deno.env.get("HELIUS_API_KEY")!;
            const assetRes  = await fetch(
              `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: "detect",
                  method: "getAsset",
                  params: { id: candidate },
                }),
              }
            );
            const assetData = await assetRes.json();
            symbol = assetData?.result?.content?.metadata?.symbol ?? null;
            name   = assetData?.result?.content?.metadata?.name   ?? null;
          } catch { /* metadata optional */ }

          // Deactivate old token
          await supabase
            .from("active_token")
            .update({ is_active: false })
            .eq("is_active", true);

          // Insert new active token
          await supabase.from("active_token").insert({
            mint_address: candidate,
            is_active:    true,
            symbol,
            name,
            pump_fun_url: `https://pump.fun/${candidate}`,
            activated_at: new Date().toISOString(),
          });

          console.log(`New pump.fun token detected: ${candidate}`);
          return new Response(
            JSON.stringify({ detected: true, mint: candidate, symbol, name }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } catch {
          continue;
        }
      }
    }

    return new Response(
      JSON.stringify({ detected: false, current_mint: currentMint }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("detect-token error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
