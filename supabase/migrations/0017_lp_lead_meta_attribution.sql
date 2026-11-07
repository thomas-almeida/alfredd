-- Atribuição dos leads originados por anúncios da Meta.
alter table public.lp_leads
  add column if not exists fbp text,
  add column if not exists fbc text,
  add column if not exists fbclid text;

create index if not exists lp_leads_fbc_idx on public.lp_leads (fbc) where fbc is not null;
