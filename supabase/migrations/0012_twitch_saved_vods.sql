-- VODs da Twitch salvas na biblioteca, incluindo a janela escolhida.
create table if not exists public.twitch_saved_vods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vod_id text not null,
  source_url text not null,
  title text not null,
  channel text,
  thumbnail_url text,
  length_seconds numeric not null,
  start_seconds numeric not null default 0,
  end_seconds numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, vod_id, start_seconds, end_seconds),
  check (length_seconds > 0),
  check (start_seconds >= 0),
  check (end_seconds > start_seconds),
  check (end_seconds <= length_seconds)
);

create index if not exists twitch_saved_vods_user_created_idx
  on public.twitch_saved_vods(user_id, created_at desc);

alter table public.twitch_saved_vods enable row level security;
drop policy if exists twitch_saved_vods_owner on public.twitch_saved_vods;
create policy twitch_saved_vods_owner on public.twitch_saved_vods
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
