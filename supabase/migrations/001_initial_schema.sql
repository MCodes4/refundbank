-- Enable realtime on distributions table (for live frontend updates)
-- Run this migration via: supabase db push

-- ─── holders ────────────────────────────────────────────────────────────────
create table if not exists holders (
  wallet              text primary key,
  token_balance       numeric not null default 0,
  avg_buy_price_usd   numeric,                   -- weighted avg buy price in USD
  total_invested_sol  numeric not null default 0, -- total SOL spent buying
  current_value_sol   numeric not null default 0, -- current token value in SOL
  pnl_sol             numeric not null default 0, -- current_value_sol - total_invested_sol
  pnl_pct             numeric,                   -- pnl as percentage
  last_updated        timestamptz not null default now()
);

-- ─── fee_claims ──────────────────────────────────────────────────────────────
create table if not exists fee_claims (
  id            bigserial primary key,
  claimed_at    timestamptz not null default now(),
  amount_sol    numeric not null,
  tx_signature  text unique not null
);

-- ─── distributions ───────────────────────────────────────────────────────────
create table if not exists distributions (
  id                bigserial primary key,
  distributed_at    timestamptz not null default now(),
  recipient_wallet  text not null,
  amount_sol        numeric not null,
  tx_signature      text unique,       -- null if tx failed / pending
  fee_claim_id      bigint references fee_claims(id),
  status            text not null default 'pending' -- pending | confirmed | failed
);

create index if not exists distributions_recipient_idx on distributions(recipient_wallet);
create index if not exists distributions_at_idx on distributions(distributed_at desc);

-- ─── config ──────────────────────────────────────────────────────────────────
create table if not exists config (
  key   text primary key,
  value text not null
);

-- Default config values
insert into config (key, value) values
  ('kill_switch',             'false'),       -- set to 'true' to halt all automation
  ('min_holder_value_sol',    '0.05'),        -- min current value to qualify
  ('min_holder_invested_sol', '0.1'),         -- min total invested to qualify
  ('max_single_payout_pct',   '0.05'),        -- max % of creator wallet per payout
  ('top_losers_count',        '20'),          -- how many holders to distribute to
  ('token_mint_address',      'PLACEHOLDER')  -- update after deploy
on conflict (key) do nothing;

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Enable realtime publication for the frontend live feed
alter publication supabase_realtime add table distributions;
alter publication supabase_realtime add table fee_claims;

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Edge functions use service key (bypasses RLS). Frontend uses anon key (read-only).
alter table holders       enable row level security;
alter table fee_claims    enable row level security;
alter table distributions enable row level security;
alter table config        enable row level security;

-- Public read-only for frontend
create policy "public read holders"       on holders       for select using (true);
create policy "public read fee_claims"    on fee_claims    for select using (true);
create policy "public read distributions" on distributions for select using (true);
create policy "public read config"        on config        for select using (true);
