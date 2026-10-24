-- Marca o último polling concluído por fonte compartilhada.
create table if not exists monitoring_source_cursors (
  source_key text primary key,
  last_polled_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table monitoring_source_cursors enable row level security;

drop policy if exists monitoring_source_cursors_admin on monitoring_source_cursors;
create policy monitoring_source_cursors_admin on monitoring_source_cursors
  for all using (is_admin()) with check (is_admin());
