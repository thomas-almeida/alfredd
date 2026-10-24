-- 0007: favoritos ilimitados no plano Free + favoritos de canais do YouTube.
--
-- 1) add_favorite deixa de aplicar a cota de 3 por tipo para o plano Free.
-- 2) youtube_favorites guarda canais do YouTube favoritados. Fica numa tabela
--    própria para não mexer no enum source_type (usado por biblioteca e
--    monitoramentos).

create or replace function add_favorite(
  p_source_type source_type,
  p_game_id uuid,
  p_streamer_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  if p_source_type = 'game' and (p_game_id is null or p_streamer_id is not null) then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;
  if p_source_type = 'streamer' and (p_streamer_id is null or p_game_id is not null) then
    return jsonb_build_object('ok', false, 'error', 'invalid_source');
  end if;

  insert into favorites (user_id, source_type, game_id, streamer_id)
  values (v_user, p_source_type, p_game_id, p_streamer_id)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

grant execute on function add_favorite(source_type, uuid, uuid) to authenticated;

create table if not exists youtube_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel_id text not null,
  title text not null,
  handle text,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  unique (user_id, channel_id)
);

create index if not exists youtube_favorites_user_created_idx
  on youtube_favorites (user_id, created_at desc);

alter table youtube_favorites enable row level security;

drop policy if exists youtube_favorites_owner on youtube_favorites;
create policy youtube_favorites_owner on youtube_favorites
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
