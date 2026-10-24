-- Histórico de ER (taxa de engajamento) do YouTube, para mostrar a curva ao longo do tempo.
-- Um snapshot por consulta ou por cron; escrita só pelo servidor (service role).

create table if not exists public.yt_engagement_snapshots (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('video', 'channel')),
  target_id   text not null,               -- videoId ou channelId
  er          numeric(7,2),                -- ER do vídeo ou ER ponderado do canal
  views       bigint,
  likes       bigint,
  comments    bigint,
  subscribers bigint,
  payload     jsonb not null,              -- resposta completa do módulo
  created_at  timestamptz not null default now()
);

create index if not exists yt_eng_target_time
  on public.yt_engagement_snapshots (kind, target_id, created_at desc);

alter table public.yt_engagement_snapshots enable row level security;

-- Leitura pública: são números públicos do YouTube.
drop policy if exists yt_eng_select_all on public.yt_engagement_snapshots;
create policy yt_eng_select_all on public.yt_engagement_snapshots
  for select using (true);
