-- Clipes — Migration 0003: funções atômicas de cota (guia §4, §9)
-- Cotas Free verificadas no BACKEND, à prova de concorrência (advisory lock
-- por usuário+escopo, dentro da transação). PRO (assinatura ativa) sem limite.

-- Assinatura PRO ativa?
create or replace function is_pro(p_user uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from subscriptions
    where user_id = p_user and status = 'active'
  );
$$;

-- ───────── Favoritar jogo/streamer com cota (Free: 3 por tipo) ─────────
create or replace function add_favorite(
  p_source_type source_type,
  p_game_id uuid,
  p_streamer_id uuid
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
  v_pro boolean;
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

  -- Serializa operações do mesmo usuário+tipo.
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':fav:' || p_source_type::text));

  v_pro := is_pro(v_user);

  if not v_pro then
    select count(*) into v_count from favorites
      where user_id = v_user and source_type = p_source_type;
    if v_count >= 3 then
      return jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'limit', 3);
    end if;
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

-- ───────── Salvar clipe na biblioteca com cota (Free: 3 por fonte) ─────────
create or replace function save_to_library(
  p_clip_id uuid,
  p_source_type source_type,
  p_game_id uuid,
  p_streamer_id uuid
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count int;
  v_pro boolean;
  v_id uuid;
  v_scope text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  -- Escopo da cota = fonte de salvamento (jogo OU streamer).
  v_scope := coalesce(p_game_id::text, p_streamer_id::text, 'none');
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':lib:' || v_scope));

  v_pro := is_pro(v_user);

  if not v_pro then
    select count(*) into v_count from library_items
      where user_id = v_user
        and saved_from_type = p_source_type
        and coalesce(saved_from_game_id, saved_from_streamer_id) =
            coalesce(p_game_id, p_streamer_id);
    if v_count >= 3 then
      return jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'limit', 3);
    end if;
  end if;

  insert into library_items (
    user_id, clip_id, saved_from_type, saved_from_game_id, saved_from_streamer_id
  ) values (
    v_user, p_clip_id, p_source_type, p_game_id, p_streamer_id
  )
  on conflict (user_id, clip_id) do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Permissões de execução para usuários autenticados.
grant execute on function add_favorite(source_type, uuid, uuid) to authenticated;
grant execute on function save_to_library(uuid, source_type, uuid, uuid) to authenticated;
grant execute on function is_pro(uuid) to authenticated;
