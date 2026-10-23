-- Plano Free: 5 clipes salvos no total (não mais por fonte) e sem remoção.
-- Remover não libera vaga: a cota conta tudo que já foi salvo e o DELETE é PRO.

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
  v_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  -- Cota global por usuário: um lock por usuário evita corrida entre fontes.
  perform pg_advisory_xact_lock(hashtext(v_user::text || ':lib'));

  if exists (select 1 from library_items where user_id = v_user and clip_id = p_clip_id) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;

  if not is_pro(v_user) then
    select count(*) into v_count from library_items where user_id = v_user;
    if v_count >= 5 then
      return jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'limit', 5);
    end if;
  end if;

  insert into library_items (
    user_id, clip_id, saved_from_type, saved_from_game_id, saved_from_streamer_id
  ) values (
    v_user, p_clip_id, p_source_type, p_game_id, p_streamer_id
  )
  on conflict (user_id, clip_id) do nothing
  returning id into v_id;

  return jsonb_build_object('ok', true, 'already', v_id is null, 'id', v_id);
end;
$$;

grant execute on function save_to_library(uuid, source_type, uuid, uuid) to authenticated;

-- RLS: separa as operações para permitir DELETE só ao PRO.
drop policy if exists library_all_own on library_items;
create policy library_select_own on library_items
  for select using (user_id = auth.uid());
create policy library_insert_own on library_items
  for insert with check (user_id = auth.uid());
create policy library_update_own on library_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy library_delete_pro on library_items
  for delete using (user_id = auth.uid() and is_pro(auth.uid()));
