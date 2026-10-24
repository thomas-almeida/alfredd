-- Vídeos do YouTube salvos para transcrição e edição.
create table if not exists public.youtube_saved_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  title text not null,
  channel_title text,
  thumbnail_url text,
  duration_ms integer,
  start_ms integer,
  end_ms integer,
  clip_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, video_id),
  check (start_ms is null or start_ms >= 0),
  check (end_ms is null or start_ms is null or end_ms > start_ms)
);

create index if not exists youtube_saved_videos_user_created_idx
  on public.youtube_saved_videos(user_id, created_at desc);

alter table public.youtube_saved_videos enable row level security;
drop policy if exists youtube_saved_videos_owner on public.youtube_saved_videos;
create policy youtube_saved_videos_owner on public.youtube_saved_videos
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
