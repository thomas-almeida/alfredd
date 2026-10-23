import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertClipCatalog } from "@/features/library/catalog";

export const runtime = "nodejs";

const MAX_SECONDS = 90;

/**
 * Registra o clipe no catálogo e devolve os dados do editor. O vídeo não é
 * copiado: o editor lê da Twitch via /api/clips/[id]/source (proxy em
 * streaming). `id` = ID do clipe na Twitch.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const cat = await upsertClipCatalog(id);
  if (!cat.ok) return NextResponse.json({ error: cat.error }, { status: 404 });
  if (cat.clip.duration > MAX_SECONDS) {
    return NextResponse.json({ error: "too_long" }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("clips")
    .select("channel, clip_status")
    .eq("id", cat.clipId)
    .single();
  if (!row) {
    return NextResponse.json({ error: "clip_persist_error" }, { status: 500 });
  }

  return NextResponse.json({
    clipId: cat.clipId,
    channel: row.channel,
    status: row.clip_status,
    duration: cat.clip.duration,
    sourceUrl: `/api/clips/${encodeURIComponent(id)}/source`,
  });
}
