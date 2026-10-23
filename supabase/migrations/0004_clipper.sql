-- Clipador: ingestão do MP4, projetos de edição, renders e presets por canal.

do $$ begin
  create type clip_status as enum ('novo', 'em_edicao', 'exportado', 'descartado');
exception when duplicate_object then null; end $$;

alter table clips
  add column if not exists slug text,
  add column if not exists channel text,
  add column if not exists clip_status clip_status not null default 'novo',
  add column if not exists source_path text,
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists fps numeric;

-- Deriva slug/canal da URL: twitch.tv/{canal}/clip/{slug} ou clips.twitch.tv/{slug}.
create or replace function clips_fill_slug_channel() returns trigger
language plpgsql as $$
declare m text[];
begin
  m := regexp_match(new.url, 'twitch\.tv/([^/?#]+)/clip/([^/?#]+)');
  if m is not null then
    new.channel := coalesce(new.channel, lower(m[1]));
    new.slug := coalesce(new.slug, m[2]);
  else
    m := regexp_match(new.url, 'clips\.twitch\.tv/(?:embed\?clip=)?([^/?#&]+)');
    if m is not null then new.slug := coalesce(new.slug, m[1]); end if;
  end if;
  new.slug := coalesce(new.slug, new.twitch_id);
  return new;
end $$;

drop trigger if exists clips_slug_channel on clips;
create trigger clips_slug_channel before insert or update of url on clips
  for each row execute function clips_fill_slug_channel();

update clips set url = url where slug is null;

create table if not exists clip_projects (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references clips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (clip_id, user_id)
);

create table if not exists renders (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references clips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_state jsonb not null,
  output_path text not null,
  duration numeric,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists channel_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  unique (user_id, channel)
);

alter table clip_projects enable row level security;
alter table renders enable row level security;
alter table channel_presets enable row level security;

create policy clip_projects_own on clip_projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy renders_own on renders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy channel_presets_own on channel_presets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- clip_status é atualizado pelo usuário logado ao editar/exportar.
create or replace function set_clip_status(p_clip_id uuid, p_status clip_status)
returns void language sql security definer set search_path = public as $$
  update clips set clip_status = p_status where id = p_clip_id and auth.uid() is not null;
$$;
grant execute on function set_clip_status(uuid, clip_status) to authenticated;

-- Storage
insert into storage.buckets (id, name, public)
  values ('clip-sources', 'clip-sources', false), ('shorts', 'shorts', false)
  on conflict (id) do nothing;

create policy shorts_own_read on storage.objects for select
  using (bucket_id = 'shorts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy shorts_own_write on storage.objects for insert
  with check (bucket_id = 'shorts' and (storage.foldername(name))[1] = auth.uid()::text);
-- clip-sources: só service role (sem policies) + signed URLs.

-- Realtime do status no card.
alter publication supabase_realtime add table clips;

-- Limpeza diária das fontes com mais de 7 dias (requer pg_cron habilitado).
do $$ begin
  perform cron.schedule('clip-sources-cleanup', '0 4 * * *', $c$
    delete from storage.objects
     where bucket_id = 'clip-sources' and created_at < now() - interval '7 days';
    update clips set source_path = null
     where source_path is not null
       and not exists (select 1 from storage.objects o
                        where o.bucket_id = 'clip-sources' and o.name = clips.source_path);
  $c$);
exception when undefined_function or invalid_schema_name then
  raise notice 'pg_cron indisponível: limpeza de clip-sources não agendada';
end $$;
