-- Leads capturados na landing page e aprovação de acesso pelos administradores.
create table if not exists public.lp_leads (
  lead_id text primary key,
  name text not null,
  email text not null,
  whatsapp text not null,
  created_at timestamptz not null default now(),
  access_granted boolean not null default false,
  access_granted_at timestamptz,
  access_granted_by uuid references public.profiles(id) on delete set null
);

create index if not exists lp_leads_created_at_idx on public.lp_leads (created_at desc);
create index if not exists lp_leads_email_idx on public.lp_leads (lower(email));

alter table public.lp_leads enable row level security;

create policy lp_leads_admin_read on public.lp_leads
  for select using (is_admin());

create policy lp_leads_admin_update on public.lp_leads
  for update using (is_admin()) with check (is_admin());

alter table public.profiles
  add column if not exists access_granted boolean not null default false;

create index if not exists profiles_access_granted_idx on public.profiles (access_granted) where access_granted;
