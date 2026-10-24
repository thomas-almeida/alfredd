import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseVideo } from "@/lib/youtube/parse";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = (await req.json()) as { videoId?: unknown; title?: unknown; channelTitle?: unknown; thumbnailUrl?: unknown; durationMs?: unknown };
  const videoId = typeof body.videoId === "string" ? parseVideo(body.videoId)?.videoId : null;
  if (!videoId) return NextResponse.json({ error: "invalid_video" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.from("youtube_saved_videos").upsert({
    user_id: session.userId,
    video_id: videoId,
    title: typeof body.title === "string" ? body.title.slice(0, 300) : videoId,
    channel_title: typeof body.channelTitle === "string" ? body.channelTitle.slice(0, 200) : null,
    thumbnail_url: typeof body.thumbnailUrl === "string" ? body.thumbnailUrl : null,
    duration_ms: typeof body.durationMs === "number" ? Math.round(body.durationMs) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,video_id" }).select("id").single();
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
