import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TranscriptError,
  getTranscript,
  parseSource,
  sourceKey,
  supabaseTranscriptStore,
} from "@/lib/transcript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Body = { url?: unknown; startMs?: unknown; endMs?: unknown; force?: unknown; vocabulary?: unknown };

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autenticado", code: "unauthenticated" }, { status: 401 });
    const body = (await req.json()) as Body;
    const url = typeof body.url === "string" ? body.url : "";
    const startMs = typeof body.startMs === "number" ? body.startMs : undefined;
    const endMs = typeof body.endMs === "number" ? body.endMs : undefined;
    if ((startMs !== undefined || endMs !== undefined) &&
        (startMs === undefined || endMs === undefined || startMs < 0 || endMs <= startMs)) {
      return NextResponse.json({ error: "Janela de VOD inválida", code: "vod_window" }, { status: 400 });
    }
    const source = parseSource(url, startMs !== undefined && endMs !== undefined ? { startMs, endMs } : undefined);
    if (!source) return NextResponse.json({ error: "Link de YouTube ou Twitch inválido", code: "invalid_source" }, { status: 400 });

    const admin = createAdminClient();
    const store = supabaseTranscriptStore(admin, { indexLines: true });
    const key = sourceKey(source);
    let cached = !body.force ? await store.get(key) : null;
    if (cached) return NextResponse.json(cached);

    const claim = await admin.rpc("claim_transcript_quota", { p_user_id: session.userId, p_kind: "transcript" });
    if (claim.error) throw claim.error;
    const result = claim.data as { ok?: boolean; error?: string; limit?: number; used?: number } | null;
    if (!result?.ok) return NextResponse.json({ error: "Cota diária de transcrições atingida", code: result?.error ?? "quota_exceeded", limit: result?.limit }, { status: 429 });

    cached = await getTranscript(source, {
      store,
      force: Boolean(body.force),
      vocabulary: typeof body.vocabulary === "string" ? body.vocabulary.slice(0, 800) : undefined,
    });
    return NextResponse.json(cached);
  } catch (e) {
    const err = e instanceof TranscriptError ? e : new TranscriptError(e instanceof Error ? e.message : String(e), 500);
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
}
