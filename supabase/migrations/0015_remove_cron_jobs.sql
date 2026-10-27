-- Os jobs agendados ficam desativados. Mantemos a migration segura quando
-- a extensao pg_cron nao estiver habilitada neste projeto.
do $$ begin
  perform cron.unschedule('clip-sources-cleanup');
exception when undefined_function or invalid_schema_name then
  raise notice 'pg_cron indisponivel: nenhum job para desagendar';
end $$;
