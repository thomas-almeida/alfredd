-- 0008: transcrição de vídeos (YouTube/Twitch) + IA de destaques.
--
-- 1) transcripts guarda uma transcrição por origem (cache compartilhado entre
--    usuários). Escrita só pelo servidor (service role ignora RLS).
-- 2) transcript_lines indexa as linhas para busca em português entre todos os
--    vídeos ("quem falou de combustível no GTA 6?").
-- 3) transcript_usage registra cada transcrição/sugestão pedida, para a cota
--    diária por plano (lib/permissions/quotas.ts).

create table if not exists public.transcripts (
  source_key  text primary key,          -- 'youtube:<id>', 'twitch_clip:<slug>', 'twitch_vod:<id>:<ini>-<fim>'
  platform    text not null,
  source      jsonb not null,
  method      text not null check (method in ('youtube_asr', 'youtube_manual', 'whisper')),
  language    text not null,
  duration_ms integer not null,
  words       jsonb not null,             -- [{text,startMs,endMs,estimated?,speakerChange?}]
  lines       jsonb not null,             -- [{index,startMs,endMs,text,wordStart,wordEnd,speakerChange?}]
  chunks      jsonb not null,             -- blocos de 25 s para o LLM
  created_at  timestamptz not null default now()
);

create table if not exists public.transcript_lines (
  source_key text not null references public.transcripts(source_key) on delete cascade,
  line_index integer not null,
  start_ms   integer not null,
  end_ms     integer not null,
  text       text not null,
  fts        tsvector generated always as (to_tsvector('portuguese', text)) stored,
  primary key (source_key, line_index)
);
create index if not exists transcript_lines_fts on public.transcript_lines using gin (fts);

-- Exemplo:
--   select source_key, start_ms, text from transcript_lines
--   where fts @@ websearch_to_tsquery('portuguese', 'combustível carros') limit 50;

alter table public.transcripts enable row level security;
alter table public.transcript_lines enable row level security;

drop policy if exists "ler transcricoes" on public.transcripts;
create policy "ler transcricoes" on public.transcripts
  for select to authenticated using (true);

drop policy if exists "ler linhas" on public.transcript_lines;
create policy "ler linhas" on public.transcript_lines
  for select to authenticated using (true);

create table if not exists public.transcript_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null check (kind in ('transcript', 'highlights')),
  created_at timestamptz not null default now()
);
create index if not exists transcript_usage_user_kind_created
  on public.transcript_usage (user_id, kind, created_at desc);

alter table public.transcript_usage enable row level security;

drop policy if exists "ler proprio uso de transcricao" on public.transcript_usage;
create policy "ler proprio uso de transcricao" on public.transcript_usage
  for select to authenticated using (auth.uid() = user_id);
