import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { twitch, type TwitchClip } from "@/lib/twitch/client";

export type CatalogResult =
  | { ok: true; clip: TwitchClip; clipId: string; gameId: string }
  | { ok: false; error: string };

/**
 * Re-busca o clipe na Twitch (não confia em dados do client) e garante as
 * linhas em games/clips via service role. Usado por "Salvar na biblioteca" e
 * pela ingestão do Clipador.
 */
export async function upsertClipCatalog(
  twitchClipId: string,
): Promise<CatalogResult> {
  const clipRes = await twitch.clipsByIds([twitchClipId]);
  const clip = clipRes.data[0];
  if (!clip) return { ok: false, error: "clip_not_found" };
  if (!clip.game_id) {
    return { ok: false, error: "Clipe sem categoria para usar como fonte." };
  }

  const admin = createAdminClient();

  const gameInfo = await twitch.gamesByIds([clip.game_id]);
  const g = gameInfo.data[0];
  const { data: game, error: gErr } = await admin
    .from("games")
    .upsert(
      {
        twitch_id: clip.game_id,
        name: g?.name ?? "Categoria",
        box_art_url: g?.box_art_url ?? null,
      },
      { onConflict: "twitch_id" },
    )
    .select("id")
    .single();
  if (gErr || !game) return { ok: false, error: "catalog_error" };

  const { data: clipRow, error: cErr } = await admin
    .from("clips")
    .upsert(
      {
        twitch_id: clip.id,
        url: clip.url,
        embed_url: clip.embed_url,
        title: clip.title,
        thumbnail_url: clip.thumbnail_url,
        duration_seconds: clip.duration,
        language: clip.language,
        game_id: game.id,
        twitch_created_at: clip.created_at,
        latest_view_count: clip.view_count,
      },
      { onConflict: "twitch_id" },
    )
    .select("id")
    .single();
  if (cErr || !clipRow) return { ok: false, error: "clip_persist_error" };

  return { ok: true, clip, clipId: clipRow.id, gameId: game.id };
}
