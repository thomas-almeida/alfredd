-- Modelos de edição ("moldes"): biblioteca de presets visuais reutilizáveis por
-- usuário (focos/enquadramento, layouts por tempo, textos, imagem/marca d'água e
-- posição das legendas). O estado fica em `state` (ver EditorTemplate no front).
create table if not exists editor_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table editor_presets enable row level security;

create policy editor_presets_own on editor_presets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists editor_presets_user_idx
  on editor_presets (user_id, updated_at desc);
