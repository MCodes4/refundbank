-- active_token: tracks which pump.fun coin is currently being monitored.
-- Only one row may have is_active = true at a time (enforced by application logic).

create table if not exists active_token (
  mint_address    text primary key,
  name            text,
  symbol          text,
  launched_at     timestamptz,                            -- on-chain creation timestamp
  activated_at    timestamptz not null default now(),     -- when we switched to this token
  is_active       boolean not null default false,
  creator_wallet  text,
  pump_fun_url    text,
  dexscreener_url text
);

create index if not exists active_token_active_idx
  on active_token (is_active)
  where is_active = true;

-- Frontend needs live updates when a new coin is launched
alter publication supabase_realtime add table active_token;

alter table active_token enable row level security;
create policy "public read active_token" on active_token for select using (true);
