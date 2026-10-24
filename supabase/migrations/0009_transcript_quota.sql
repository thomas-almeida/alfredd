-- Reserva atômica das cotas de transcrição/destaques.
-- A função recebe o usuário porque as rotas usam o service role para gravar
-- o cache compartilhado e, portanto, não têm auth.uid() disponível.
create or replace function public.claim_transcript_quota(
  p_user_id uuid,
  p_kind text
) returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
  v_pro boolean;
begin
  if p_user_id is null or p_kind not in ('transcript', 'highlights') then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text || ':transcript:' || p_kind));
  select exists (select 1 from subscriptions where user_id = p_user_id and status = 'active') into v_pro;
  v_limit := case when p_kind = 'transcript' then case when v_pro then 50 else 3 end
             else case when v_pro then 30 else 3 end end;
  select count(*)::integer into v_used
    from transcript_usage
   where user_id = p_user_id and kind = p_kind
     and created_at >= date_trunc('day', now());

  if v_used >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'quota_exceeded', 'limit', v_limit, 'used', v_used);
  end if;

  insert into transcript_usage(user_id, kind) values (p_user_id, p_kind);
  return jsonb_build_object('ok', true, 'limit', v_limit, 'used', v_used + 1);
end;
$$;

revoke all on function public.claim_transcript_quota(uuid, text) from public;
grant execute on function public.claim_transcript_quota(uuid, text) to service_role;
