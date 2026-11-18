-- 0019: reintroduz o teto de favoritos no plano Free (3 jogos + 3 criadores).
--
-- A migração 0007 removeu a cota de favoritos ("ilimitado no Free"). Para o
-- lançamento o Free volta a ter limite: 3 jogos e 3 CRIADORES, onde "criadores"
-- soma streamers da Twitch + canais do YouTube (favoritar YouTube também conta).
-- Usuários PRO (assinatura ativa ou access_granted) seguem ilimitados. O
-- favorito de YouTube (tabela youtube_favorites) aplica o mesmo teto na action.

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

  -- Serializa operações do mesmo usuário+tipo para o count/insert ser atômico.
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':fav:' || p_source_type::text));

  v_pro := is_pro(v_user);

  if not v_pro then
    if p_source_type = 'game' then
      select count(*) into v_count from favorites
        where user_id = v_user and source_type = 'game';
    else
      -- "Criadores" = streamers da Twitch + canais do YouTube (teto combinado).
      select (select count(*) from favorites
                where user_id = v_user and source_type = 'streamer')
           + (select count(*) from youtube_favorites where user_id = v_user)
        into v_count;
    end if;
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

grant execute on function add_favorite(source_type, uuid, uuid) to authenticated;
