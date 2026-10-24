-- Destaques sugeridos pela IA, salvos por fonte (mesmo source_key de transcripts).
-- Cache global: o mesmo vídeo/janela com os mesmos parâmetros não gasta cota de novo.
create table if not exists public.video_highlights (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  params text not null,
  prompt_version integer not null default 1,
  model text,
  highlights jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, params, prompt_version)
);

alter table public.video_highlights enable row level security;
-- Leitura para qualquer usuário autenticado; escrita só pelo service role.
drop policy if exists video_highlights_read on public.video_highlights;
create policy video_highlights_read on public.video_highlights
  for select to authenticated using (true);
