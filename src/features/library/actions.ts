"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { upsertClipCatalog } from "./catalog";
import type { LibraryStatus } from "@/lib/supabase/database.types";

export interface SaveResult {
  ok: boolean;
  error?: string;
  already?: boolean;
  needsAuth?: boolean;
  quotaExceeded?: boolean;
}

/**
 * Salva um clipe na biblioteca a partir do seu ID da Twitch. O servidor
 * re-busca o clipe (não confia em dados do client), faz upsert de catálogo e
 * aplica a cota atomicamente via RPC. Fonte de salvamento = categoria do clipe.
 */
export async function saveClip(twitchClipId: string): Promise<SaveResult> {
  const session = await getSession();
  if (!session) return { ok: false, needsAuth: true, error: "unauthenticated" };

  const cat = await upsertClipCatalog(twitchClipId);
  if (!cat.ok) return { ok: false, error: cat.error };
  const clipRow = { id: cat.clipId };
  const game = { id: cat.gameId };

  // 4. Cota atômica + inserção na biblioteca.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_to_library", {
    p_clip_id: clipRow.id,
    p_source_type: "game",
    p_game_id: game.id,
    p_streamer_id: null,
  });
  if (error) return { ok: false, error: error.message };

  const res = data as { ok: boolean; error?: string; already?: boolean };
  if (!res.ok && res.error === "quota_exceeded") {
    return {
      ok: false,
      quotaExceeded: true,
      error:
        "Limite do plano Free atingido (5 clipes). Assine o PRO para salvar e editar mais clipes.",
    };
  }

  revalidatePath("/biblioteca");
  revalidatePath("/", "layout");
  return { ok: res.ok, already: res.already, error: res.error };
}

/** Atualiza o status de um item da biblioteca (salvo / em edição / publicado). */
export async function setLibraryStatus(
  itemId: string,
  status: LibraryStatus,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("library_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  revalidatePath("/biblioteca");
  revalidatePath("/", "layout");
  return { ok: !error };
}

/** Remove um item da biblioteca. Exclusivo do PRO (o Free não remove clipes). */
export async function removeLibraryItem(
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthenticated" };
  if (!session.isPro) {
    return { ok: false, error: "Remover clipes é exclusivo do plano PRO." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("library_items")
    .delete()
    .eq("id", itemId);
  revalidatePath("/biblioteca");
  revalidatePath("/", "layout");
  return { ok: !error };
}
