"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

type Result = { ok: boolean; error?: string };

export async function createMonitoring(input: { sourceType: "game" | "streamer"; sourceId: string }): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Faça login para monitorar conteúdos." };
  if (!session.isPro) return { ok: false, error: "Monitoramentos são exclusivos do PRO." };
  const db = await createClient();
  const adminDb = db as any;
  const { count } = await adminDb.from("monitorings").select("id", { count: "exact", head: true }).eq("user_id", session.userId).eq("active", true);
  if ((count ?? 0) >= 20) return { ok: false, error: "Você atingiu o limite de 20 monitoramentos ativos." };
  const column = input.sourceType === "game" ? "game_id" : "streamer_id";
  const existing = await adminDb.from("monitorings").select("id").eq("user_id", session.userId).eq(column, input.sourceId).maybeSingle();
  if (existing.error) return { ok: false, error: "Não foi possível consultar o monitoramento." };
  if (existing.data) {
    const { error } = await adminDb.from("monitorings").update({ active: true }).eq("id", existing.data.id).eq("user_id", session.userId);
    if (error) return { ok: false, error: "Não foi possível reativar o monitoramento." };
    revalidatePath("/monitoramentos");
    return { ok: true };
  }
  const payload = input.sourceType === "game"
    ? { user_id: session.userId, source_type: "game", game_id: input.sourceId, streamer_id: null }
    : { user_id: session.userId, source_type: "streamer", game_id: null, streamer_id: input.sourceId };
  const { error } = await adminDb.from("monitorings").insert(payload);
  if (error) return { ok: false, error: "Não foi possível ativar o monitoramento." };
  revalidatePath("/monitoramentos");
  return { ok: true };
}

export async function disableMonitoring(id: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Faça login para continuar." };
  const db = await createClient();
  const { error } = await (db as any).from("monitorings").update({ active: false }).eq("id", id).eq("user_id", session.userId);
  if (error) return { ok: false, error: "Não foi possível desativar o monitoramento." };
  revalidatePath("/monitoramentos");
  return { ok: true };
}

export async function enableEmailAlerts(): Promise<Result> {
  const session = await getSession();
  if (!session?.email) return { ok: false, error: "Sua conta não possui um e-mail confirmado." };
  if (!session.isPro) return { ok: false, error: "Alertas são exclusivos do PRO." };
  const db = await createClient();
  const adminDb = db as any;
  const existing = await adminDb.from("notification_channels").select("id").eq("user_id", session.userId).eq("kind", "email").maybeSingle();
  const result = existing.data
    ? await adminDb.from("notification_channels").update({ address: session.email, verified: true, active: true, consented_at: new Date().toISOString() }).eq("id", existing.data.id)
    : await adminDb.from("notification_channels").insert({ user_id: session.userId, kind: "email", address: session.email, verified: true, active: true, consented_at: new Date().toISOString() });
  if (result.error) return { ok: false, error: "Não foi possível ativar os alertas por e-mail." };
  revalidatePath("/notificacoes");
  return { ok: true };
}

export async function disableEmailAlerts(): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Faça login para continuar." };
  const db = await createClient();
  const { error } = await (db as any).from("notification_channels").update({ active: false }).eq("user_id", session.userId).eq("kind", "email");
  if (error) return { ok: false, error: "Não foi possível pausar os alertas." };
  revalidatePath("/notificacoes");
  return { ok: true };
}
