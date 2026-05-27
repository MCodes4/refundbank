-- Add mint_address to fee_claims and distributions so stats can be scoped per token.
-- Existing rows get NULL (will be excluded from per-token queries).

alter table fee_claims    add column if not exists mint_address text;
alter table distributions add column if not exists mint_address text;

create index if not exists fee_claims_mint_idx    on fee_claims    (mint_address);
create index if not exists distributions_mint_idx on distributions (mint_address);
