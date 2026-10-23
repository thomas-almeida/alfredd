"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

/**
 * Próximo clipe da biblioteca do usuário ainda não trabalhado (clip_status
 * 'novo'), do mais antigo salvo para o mais novo. Retorna o ID da Twitch.
 */
export async function nextClip(currentClipId: string): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("library_items")
    .select("clip_id, clips!inner(twitch_id, clip_status)")
    .eq("user_id", session.userId)
    .neq("clip_id", currentClipId)
    .eq("clips.clip_status", "novo")
    .order("created_at", { ascending: true })
    .limit(1);
  const row = data?.[0] as { clips?: { twitch_id: string } | null } | undefined;
  return row?.clips?.twitch_id ?? null;
}
