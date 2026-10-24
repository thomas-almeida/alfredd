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
  if (error === "unauthenticated") return "Faça login para favoritar.";
  return error;
}

/** Remove um favorito de jogo ou streamer. */
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

/** Remove um canal do YouTube dos favoritos. */
export async function removeYoutubeFavorite(
  favoriteId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("youtube_favorites")
    .delete()
    .eq("id", favoriteId);
  revalidatePath("/favoritos");
  revalidatePath("/", "layout");
  return { ok: !error };
}

export type FavoriteTarget =
  | { kind: "game"; twitchId: string }
  | { kind: "streamer"; twitchId: string }
  | { kind: "youtuber"; channelId: string };

/** Id do favorito do usuário para o alvo, ou null se não favoritado. */
async function findFavoriteId(target: FavoriteTarget): Promise<string | null> {
  const supabase = await createClient();
  if (target.kind === "youtuber") {
    const { data } = await supabase
      .from("youtube_favorites")
      .select("id")
      .eq("channel_id", target.channelId)
      .maybeSingle();
    return data?.id ?? null;
  }

  const table = target.kind === "game" ? "games" : "streamers";
  const { data: catalog } = await supabase
    .from(table)
    .select("id")
    .eq("twitch_id", target.twitchId)
    .maybeSingle();
  if (!catalog) return null;

  const { data } = await supabase
    .from("favorites")
    .select("id")
    .eq(target.kind === "game" ? "game_id" : "streamer_id", catalog.id)
    .maybeSingle();
  return data?.id ?? null;
}

/** Indica se o alvo já está nos favoritos do usuário logado. */
export async function isFavorited(target: FavoriteTarget): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return (await findFavoriteId(target)) !== null;
}

/** Remove dos favoritos pelo id natural (Twitch ou canal do YouTube). */
export async function unfavorite(target: FavoriteTarget): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const favoriteId = await findFavoriteId(target);
  if (!favoriteId) return { ok: true, already: true };

  const { ok } =
    target.kind === "youtuber"
      ? await removeYoutubeFavorite(favoriteId)
      : await removeFavorite(favoriteId);
  return ok ? { ok: true } : { ok: false, error: "Não foi possível remover dos favoritos." };
}

/** Favorita um canal do YouTube (tabela própria, sem catálogo). */
export async function favoriteYoutuber(input: {
  channelId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();
  const { error } = await supabase.from("youtube_favorites").upsert(
    {
      user_id: session.userId,
      channel_id: input.channelId,
      title: input.title,
      handle: input.handle,
      thumbnail_url: input.thumbnailUrl,
    },
    { onConflict: "user_id,channel_id" },
  );
  if (error) return { ok: false, error: "Não foi possível favoritar o canal." };

  revalidatePath("/favoritos");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Favorita um jogo (upsert do catálogo no backend). */
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

/** Favorita um streamer (upsert do catálogo no backend). */
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
