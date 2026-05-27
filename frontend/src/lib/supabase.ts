import { createClient as _createClient } from "@supabase/supabase-js";

export const supabase = _createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Holder = {
  wallet: string;
  token_balance: number;
  total_invested_sol: number;
  current_value_sol: number;
  pnl_sol: number;
  pnl_pct: number | null;
  last_updated: string;
};

export type Distribution = {
  id: number;
  distributed_at:  string;
  recipient_wallet: string;
  amount_sol:       number;
  tx_signature:     string | null;
  status:           string;
  mint_address:     string | null;
};

export type FeeClaim = {
  id: number;
  claimed_at: string;
  amount_sol: number;
  tx_signature: string;
  mint_address: string | null;
};

export type ActiveToken = {
  mint_address:    string;
  name:            string | null;
  symbol:          string | null;
  launched_at:     string | null;
  activated_at:    string;
  is_active:       boolean;
  creator_wallet:  string | null;
  pump_fun_url:    string | null;
  dexscreener_url: string | null;
};
