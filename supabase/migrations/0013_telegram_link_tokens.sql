-- Tokens temporários para vincular a conta do Telegram sem expor o identificador do usuário.
create table if not exists telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_link_tokens_active_idx
  on telegram_link_tokens (token_hash, expires_at)
  where used_at is null;

alter table telegram_link_tokens enable row level security;

drop policy if exists telegram_link_tokens_owner on telegram_link_tokens;
create policy telegram_link_tokens_owner on telegram_link_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
