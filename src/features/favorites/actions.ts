"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";

export interface ActionResult {
  ok: boolean;
  error?: string;
  already?: boolean;
}

function quotaMessage(error?: string): string | undefined {
  if (error === "quota_exceeded")
    return "Limite do plano Free atingido (3 por tipo). Remova um favorito ou assine o PRO.";
  if (error === "unauthenticated") return "Faça login para favoritar.";
  return error;
}

/** Remove um favorito (libera cota). */
export async function removeFavorite(
  favoriteId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("id", favoriteId);
  revalidatePath("/favoritos");
  revalidatePath("/", "layout");
  return { ok: !error };
}

/** Favorita um jogo (upsert do catálogo + cota atômica no backend). */
export async function favoriteGame(input: {
  twitchId: string;
  name: string;
  boxArtUrl: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const admin = createAdminClient();
  const { data: game, error: upErr } = await admin
    .from("games")
    .upsert(
      { twitch_id: input.twitchId, name: input.name, box_art_url: input.boxArtUrl },
      { onConflict: "twitch_id" },
    )
    .select("id")
    .single();
  if (upErr || !game) return { ok: false, error: "catalog_error" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_favorite", {
    p_source_type: "game",
    p_game_id: game.id,
    p_streamer_id: null,
  });
  if (error) return { ok: false, error: error.message };

  const res = data as { ok: boolean; error?: string; already?: boolean };
  revalidatePath("/favoritos");
  revalidatePath("/", "layout");
  return { ok: res.ok, error: quotaMessage(res.error), already: res.already };
}

/** Favorita um streamer (upsert do catálogo + cota atômica no backend). */
export async function favoriteStreamer(input: {
  twitchId: string;
  login: string;
  displayName: string;
  thumbnailUrl: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const admin = createAdminClient();
  const { data: streamer, error: upErr } = await admin
    .from("streamers")
    .upsert(
      {
        twitch_id: input.twitchId,
        login: input.login,
        display_name: input.displayName,
        thumbnail_url: input.thumbnailUrl,
      },
      { onConflict: "twitch_id" },
    )
    .select("id")
    .single();
  if (upErr || !streamer) return { ok: false, error: "catalog_error" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_favorite", {
    p_source_type: "streamer",
    p_game_id: null,
    p_streamer_id: streamer.id,
  });
  if (error) return { ok: false, error: error.message };

  const res = data as { ok: boolean; error?: string; already?: boolean };
  revalidatePath("/favoritos");
  revalidatePath("/", "layout");
  return { ok: res.ok, error: quotaMessage(res.error), already: res.already };
}
