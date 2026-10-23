-- Clipes — Migration 0002: Row Level Security
-- Dados pessoais: somente o dono. Catálogo público: leitura aberta, escrita
-- apenas via service role (ingestão server-side, que ignora RLS).

-- Helper: usuário é admin?
create or replace function is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ───────── Catálogo público (leitura para todos) ─────────
alter table games enable row level security;
alter table streamers enable row level security;
alter table clips enable row level security;
alter table clip_scores enable row level security;

create policy games_read on games for select using (true);
create policy streamers_read on streamers for select using (true);
create policy clips_read on clips for select using (true);
create policy clip_scores_read on clip_scores for select using (true);
-- Sem policies de escrita: INSERT/UPDATE/DELETE apenas via service role.

-- Snapshots: internos ao scoring. Sem leitura pública.
alter table clip_view_snapshots enable row level security;

-- ───────── Perfis ─────────
alter table profiles enable row level security;
create policy profiles_select_own on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ───────── Favoritos ─────────
alter table favorites enable row level security;
create policy favorites_all_own on favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────── Biblioteca ─────────
alter table library_items enable row level security;
create policy library_all_own on library_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────── Monitoramentos ─────────
alter table monitorings enable row level security;
create policy monitorings_all_own on monitorings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────── Notificações ─────────
alter table notification_channels enable row level security;
create policy channels_all_own on notification_channels
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table notification_deliveries enable row level security;
create policy deliveries_select_own on notification_deliveries
  for select using (user_id = auth.uid() or is_admin());
-- Escrita de entregas apenas via service role (dispatcher).

-- ───────── Assinaturas / billing ─────────
alter table subscriptions enable row level security;
create policy subscriptions_select_own on subscriptions
  for select using (user_id = auth.uid() or is_admin());
-- Mudança de status apenas via service role (webhook verificado).

alter table billing_events enable row level security;
-- Sem policies: apenas service role (nunca exposto ao cliente).

-- ───────── Jobs (apenas admin lê; escrita via service role) ─────────
alter table source_jobs enable row level security;
alter table job_runs enable row level security;
create policy source_jobs_admin_read on source_jobs for select using (is_admin());
create policy job_runs_admin_read on job_runs for select using (is_admin());
