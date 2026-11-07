-- Campanha, anúncio, posicionamento e UTMs associados ao lead.
alter table public.lp_leads
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists campaign_id text,
  add column if not exists campaign_name text,
  add column if not exists adset_id text,
  add column if not exists adset_name text,
  add column if not exists ad_id text,
  add column if not exists ad_name text,
  add column if not exists placement text,
  add column if not exists site_source_name text;

create index if not exists lp_leads_campaign_id_idx on public.lp_leads (campaign_id) where campaign_id is not null;
create index if not exists lp_leads_ad_id_idx on public.lp_leads (ad_id) where ad_id is not null;
