-- Clipes — Migration 0001: schema inicial
-- Entidades conforme guia §9. Datas sempre em UTC (timestamptz).

create extension if not exists pgcrypto;

-- ───────────────────────── Enums ─────────────────────────
create type plan_type as enum ('free', 'pro');
create type source_type as enum ('game', 'streamer');
create type subscription_status as enum ('pending', 'active', 'past_due', 'canceled');
create type library_status as enum ('salvo', 'em_edicao', 'publicado');
create type monitoring_frequency as enum ('imediato', 'resumo_horario', 'resumo_diario');
create type monitoring_trigger as enum ('novo_clipe', 'score_minimo');
create type channel_kind as enum ('telegram', 'email');
create type delivery_status as enum ('pending', 'sent', 'failed');
create type clip_score_status as enum ('ok', 'novo', 'insuficiente');
create type job_kind as enum ('discovery', 'ingestion', 'view_refresh', 'score', 'alert_match', 'dispatch');
create type job_status as enum ('pending', 'running', 'success', 'error');

-- ───────────────────────── Perfis ─────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan plan_type not null default 'free',
  timezone text not null default 'America/Sao_Paulo',
  is_admin boolean not null default false,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────── Catálogo em cache (dados Twitch) ─────────────────
create table games (
  id uuid primary key default gen_random_uuid(),
  twitch_id text not null unique,
  name text not null,
  box_art_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table streamers (
  id uuid primary key default gen_random_uuid(),
  twitch_id text not null unique,
  login text not null unique,
  display_name text not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────── Clipes ─────────────────────────
create table clips (
  id uuid primary key default gen_random_uuid(),
  twitch_id text not null unique,           -- dedupe pelo ID único da Twitch
  url text not null,
  embed_url text,
  title text,
  thumbnail_url text,
  duration_seconds numeric,
  language text,
  game_id uuid references games (id) on delete set null,
  streamer_id uuid references streamers (id) on delete set null,
  twitch_created_at timestamptz not null,   -- created_at da Twitch (UTC)
  latest_view_count integer,
  synced_at timestamptz not null default now()
);

create index clips_game_created_idx on clips (game_id, twitch_created_at desc);
create index clips_streamer_created_idx on clips (streamer_id, twitch_created_at desc);
create index clips_views_idx on clips (latest_view_count desc);

create table clip_view_snapshots (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references clips (id) on delete cascade,
  view_count integer not null,
  observed_at timestamptz not null default now()
);
create index clip_snapshots_clip_idx on clip_view_snapshots (clip_id, observed_at desc);

create table clip_scores (
  id uuid primary key default gen_random_uuid(),
  clip_id uuid not null references clips (id) on delete cascade,
  value integer,                            -- 0..100 ou null quando insuficiente
  status clip_score_status not null,
  version text not null,
  factors jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  constraint clip_scores_value_range check (value is null or (value between 0 and 100))
);
create index clip_scores_clip_idx on clip_scores (clip_id, computed_at desc);

-- ───────────────────────── Favoritos ─────────────────────────
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type source_type not null,
  game_id uuid references games (id) on delete cascade,
  streamer_id uuid references streamers (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint favorites_one_source check (
    (source_type = 'game' and game_id is not null and streamer_id is null) or
    (source_type = 'streamer' and streamer_id is not null and game_id is null)
  )
);
create unique index favorites_unique_game on favorites (user_id, game_id) where game_id is not null;
create unique index favorites_unique_streamer on favorites (user_id, streamer_id) where streamer_id is not null;

-- ───────────────────────── Biblioteca ─────────────────────────
-- Associação única usuário–clipe (impede duplicar para burlar cota).
create table library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  clip_id uuid not null references clips (id) on delete cascade,
  saved_from_type source_type not null,
  saved_from_game_id uuid references games (id) on delete set null,
  saved_from_streamer_id uuid references streamers (id) on delete set null,
  status library_status not null default 'salvo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint library_unique_user_clip unique (user_id, clip_id)
);
create index library_user_source_idx on library_items (user_id, saved_from_type, saved_from_game_id, saved_from_streamer_id);

-- ───────────────────────── Monitoramentos ─────────────────────────
create table monitorings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type source_type not null,
  game_id uuid references games (id) on delete cascade,
  streamer_id uuid references streamers (id) on delete cascade,
  trigger_type monitoring_trigger not null default 'novo_clipe',
  min_score integer check (min_score is null or (min_score between 0 and 100)),
  frequency monitoring_frequency not null default 'imediato',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint monitoring_one_source check (
    (source_type = 'game' and game_id is not null and streamer_id is null) or
    (source_type = 'streamer' and streamer_id is not null and game_id is null)
  )
);
create unique index monitoring_unique_game on monitorings (user_id, game_id) where game_id is not null;
create unique index monitoring_unique_streamer on monitorings (user_id, streamer_id) where streamer_id is not null;
create index monitoring_active_idx on monitorings (active) where active;

-- ───────────────────── Notificações ─────────────────────
create table notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind channel_kind not null,
  address text,            -- e-mail
  telegram_chat_id text,   -- chat vinculado
  consented_at timestamptz,
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint channel_unique_user_kind_target unique (user_id, kind, address, telegram_chat_id)
);

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  monitoring_id uuid references monitorings (id) on delete set null,
  clip_id uuid references clips (id) on delete set null,
  channel_kind channel_kind not null,
  dedupe_key text not null,  -- usuário+regra+clipe+tipo
  status delivery_status not null default 'pending',
  attempt integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  constraint delivery_dedupe_unique unique (dedupe_key)
);
create index delivery_user_idx on notification_deliveries (user_id, created_at desc);

-- ───────────────────── Assinaturas / billing ─────────────────────
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan plan_type not null default 'free',
  status subscription_status not null default 'pending',
  provider text,
  external_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  external_id text not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_events_idempotent unique (provider, external_id)
);

-- ───────────────────── Jobs do coletor ─────────────────────
create table source_jobs (
  id uuid primary key default gen_random_uuid(),
  source_type source_type not null,
  game_id uuid references games (id) on delete cascade,
  streamer_id uuid references streamers (id) on delete cascade,
  kind job_kind not null,
  priority integer not null default 100,
  next_run_at timestamptz not null default now(),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index source_jobs_schedule_idx on source_jobs (active, next_run_at) where active;

create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references source_jobs (id) on delete cascade,
  status job_status not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  checkpoint jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);
create index job_runs_job_idx on job_runs (job_id, created_at desc);

-- Cria profile + subscription ao surgir um auth.users.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.subscriptions (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
