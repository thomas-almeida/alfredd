import "server-only";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

export type SnapshotKind = "video" | "channel";

export type SnapshotFields = {
  er: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  subscribers?: number | null;
};

export type SnapshotPoint = {
  created_at: string;
  er: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  subscribers: number | null;
};

/** No máximo um snapshot por alvo nesta janela. */
const MIN_INTERVAL_MS = 60 * 60 * 1000;

async function insertIfStale(
  kind: SnapshotKind,
  targetId: string,
  fields: SnapshotFields,
  payload: unknown,
): Promise<void> {
  const db = createAdminClient();
  const since = new Date(Date.now() - MIN_INTERVAL_MS).toISOString();
  const { data: recent } = await db
    .from("yt_engagement_snapshots")
    .select("id")
    .eq("kind", kind)
    .eq("target_id", targetId)
    .gte("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) return;

  await db.from("yt_engagement_snapshots").insert({
    kind,
    target_id: targetId,
    er: fields.er,
    views: fields.views ?? null,
    likes: fields.likes ?? null,
    comments: fields.comments ?? null,
    subscribers: fields.subscribers ?? null,
    payload: payload as Json,
  });
}

/**
 * Grava um ponto da curva de ER. Nunca rejeita: sem service role não faz nada
 * e erros são ignorados. Nas rotas, chame dentro de `after()` para não atrasar a resposta.
 */
export async function recordSnapshot(
  kind: SnapshotKind,
  targetId: string,
  fields: SnapshotFields,
  payload: unknown,
): Promise<void> {
  if (!getServerEnv().SUPABASE_SERVICE_ROLE_KEY) return;
  await insertIfStale(kind, targetId, fields, payload).catch(() => {});
}

/** Pontos do histórico em ordem cronológica (leitura pública via RLS). */
export async function getSnapshotHistory(
  kind: SnapshotKind,
  targetId: string,
  days: number,
): Promise<SnapshotPoint[]> {
  const db = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("yt_engagement_snapshots")
    .select("created_at, er, views, likes, comments, subscribers")
    .eq("kind", kind)
    .eq("target_id", targetId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return (data ?? []).map((r) => ({
    created_at: r.created_at,
    er: num(r.er),
    views: num(r.views),
    likes: num(r.likes),
    comments: num(r.comments),
    subscribers: num(r.subscribers),
  }));
}
