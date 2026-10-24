/**
 * Tipos do banco (escritos à mão, fiéis a supabase/migrations).
 * Para regenerar a partir do projeto: `npm run db:types` (requer acesso ao DB).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Plan = "free" | "pro";
export type SourceType = "game" | "streamer";
export type SubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "canceled";
export type LibraryStatus = "salvo" | "em_edicao" | "publicado";
export type ClipScoreStatus = "ok" | "novo" | "insuficiente";
export type ClipStatus = "novo" | "em_edicao" | "exportado" | "descartado";

type GamesRow = {
  id: string;
  twitch_id: string;
  name: string;
  box_art_url: string | null;
  created_at: string;
  updated_at: string;
}
type StreamersRow = {
  id: string;
  twitch_id: string;
  login: string;
  display_name: string;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}
type ClipsRow = {
  id: string;
  twitch_id: string;
  url: string;
  embed_url: string | null;
  title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  language: string | null;
  game_id: string | null;
  streamer_id: string | null;
  twitch_created_at: string;
  latest_view_count: number | null;
  synced_at: string;
  slug: string | null;
  channel: string | null;
  clip_status: ClipStatus;
  source_path: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
}
type ClipProjectsRow = {
  id: string;
  clip_id: string;
  user_id: string;
  state: Json;
  updated_at: string;
}
type RendersRow = {
  id: string;
  clip_id: string;
  user_id: string;
  project_state: Json;
  output_path: string;
  duration: number | null;
  size_bytes: number | null;
  created_at: string;
}
type ChannelPresetsRow = {
  id: string;
  user_id: string;
  channel: string;
  state: Json;
  updated_at: string;
}
type ProfilesRow = {
  id: string;
  plan: Plan;
  timezone: string;
  is_admin: boolean;
  preferences: Json;
  created_at: string;
}
type FavoritesRow = {
  id: string;
  user_id: string;
  source_type: SourceType;
  game_id: string | null;
  streamer_id: string | null;
  created_at: string;
}
type LibraryItemsRow = {
  id: string;
  user_id: string;
  clip_id: string;
  saved_from_type: SourceType;
  saved_from_game_id: string | null;
  saved_from_streamer_id: string | null;
  status: LibraryStatus;
  created_at: string;
  updated_at: string;
}
type SubscriptionsRow = {
  id: string;
  user_id: string;
  plan: Plan;
  status: SubscriptionStatus;
  provider: string | null;
  external_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

type YtEngagementSnapshotsRow = {
  id: number;
  kind: "video" | "channel";
  target_id: string;
  er: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  subscribers: number | null;
  payload: Json;
  created_at: string;
}

type YoutubeFavoritesRow = {
  id: string;
  user_id: string;
  channel_id: string;
  title: string;
  handle: string | null;
  thumbnail_url: string | null;
  created_at: string;
};

type TranscriptsRow = {
  source_key: string;
  platform: string;
  source: Json;
  method: "youtube_asr" | "youtube_manual" | "whisper";
  language: string;
  duration_ms: number;
  words: Json;
  lines: Json;
  chunks: Json;
  created_at: string;
};

type TranscriptLinesRow = {
  source_key: string;
  line_index: number;
  start_ms: number;
  end_ms: number;
  text: string;
};

type TranscriptUsageRow = {
  id: string;
  user_id: string;
  kind: "transcript" | "highlights";
  created_at: string;
};

type YoutubeSavedVideosRow = {
  id: string;
  user_id: string;
  video_id: string;
  title: string;
  channel_title: string | null;
  thumbnail_url: string | null;
  duration_ms: number | null;
  start_ms: number | null;
  end_ms: number | null;
  clip_text: string | null;
  created_at: string;
  updated_at: string;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfilesRow>;
      games: Table<GamesRow>;
      streamers: Table<StreamersRow>;
      clips: Table<ClipsRow>;
      favorites: Table<FavoritesRow>;
      library_items: Table<LibraryItemsRow>;
      subscriptions: Table<SubscriptionsRow>;
      clip_projects: Table<ClipProjectsRow>;
      renders: Table<RendersRow>;
      channel_presets: Table<ChannelPresetsRow>;
      yt_engagement_snapshots: Table<YtEngagementSnapshotsRow>;
      youtube_favorites: Table<YoutubeFavoritesRow>;
      transcripts: Table<TranscriptsRow>;
      transcript_lines: Table<TranscriptLinesRow>;
      transcript_usage: Table<TranscriptUsageRow>;
      youtube_saved_videos: Table<YoutubeSavedVideosRow>;
    };
    Views: Record<string, never>;
    Functions: {
      add_favorite: {
        Args: {
          p_source_type: SourceType;
          p_game_id: string | null;
          p_streamer_id: string | null;
        };
        Returns: Json;
      };
      save_to_library: {
        Args: {
          p_clip_id: string;
          p_source_type: SourceType;
          p_game_id: string | null;
          p_streamer_id: string | null;
        };
        Returns: Json;
      };
      set_clip_status: {
        Args: { p_clip_id: string; p_status: ClipStatus };
        Returns: undefined;
      };
      claim_transcript_quota: {
        Args: { p_user_id: string; p_kind: "transcript" | "highlights" };
        Returns: Json;
      };
    };
    Enums: {
      plan_type: Plan;
      source_type: SourceType;
      subscription_status: SubscriptionStatus;
      library_status: LibraryStatus;
      clip_status: ClipStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
