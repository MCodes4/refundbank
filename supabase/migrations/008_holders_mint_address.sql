-- Scope holders per mint: add mint_address column and change PK to (wallet, mint_address).
-- This ensures distribute only pays holders of the currently active token.

alter table holders
  add column if not exists mint_address text not null default '';

-- Drop old single-column PK, add composite PK
alter table holders drop constraint if exists holders_pkey;
alter table holders add primary key (wallet, mint_address);

create index if not exists holders_mint_idx on holders(mint_address);
