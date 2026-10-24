import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TranscriptError, getTranscript, geminiComplete, openAiCompatibleComplete, parseSource,
  HIGHLIGHT_PROMPT_VERSION, sourceKey, suggestHighlights, supabaseTranscriptStore, type Highlight, type Signal,
} from "@/lib/transcript";
import type { Json } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autenticado", code: "unauthenticated" }, { status: 401 });
    const b = (await req.json()) as {
      url?: unknown; startMs?: unknown; endMs?: unknown; count?: unknown;
      minSeconds?: unknown; maxSeconds?: unknown; context?: unknown; signals?: unknown;
      force?: unknown; cachedOnly?: unknown;
    };
    const startMs = typeof b.startMs === "number" ? b.startMs : undefined;
    const endMs = typeof b.endMs === "number" ? b.endMs : undefined;
    const source = parseSource(typeof b.url === "string" ? b.url : "", startMs !== undefined && endMs !== undefined ? { startMs, endMs } : undefined);
    if (!source) return NextResponse.json({ error: "Link de YouTube ou Twitch inválido", code: "invalid_source" }, { status: 400 });
    const count = typeof b.count === "number" ? Math.max(1, Math.min(10, Math.round(b.count))) : 5;
    const minSeconds = typeof b.minSeconds === "number" ? Math.max(5, Math.min(90, b.minSeconds)) : 15;
    const maxSeconds = typeof b.maxSeconds === "number" ? Math.max(10, Math.min(90, b.maxSeconds)) : 60;
    const signals = Array.isArray(b.signals) ? b.signals as Signal[] : undefined;
    const key = sourceKey(source);
    const params = `c${count}:${minSeconds}-${maxSeconds}`;
    // Sinais externos mudam o resultado e não entram na chave: nesse caso não usa o cache.
    const cacheable = !signals?.length;
    const admin = createAdminClient();

    // Destaques já salvos para a mesma fonte e parâmetros não gastam cota.
    if (cacheable && b.force !== true) {
      const saved = await admin.from("video_highlights").select("highlights, updated_at")
        .eq("source_key", key).eq("params", params).eq("prompt_version", HIGHLIGHT_PROMPT_VERSION).maybeSingle();
      if (saved.error) throw saved.error;
      if (saved.data) return NextResponse.json({ highlights: saved.data.highlights as Highlight[], cached: true, createdAt: saved.data.updated_at });
    }
    if (b.cachedOnly === true) return NextResponse.json({ highlights: null });

    const claim = await admin.rpc("claim_transcript_quota", { p_user_id: session.userId, p_kind: "highlights" });
    if (claim.error) throw claim.error;
    const quota = claim.data as { ok?: boolean; error?: string; limit?: number; used?: number } | null;
    if (!quota?.ok) return NextResponse.json({ error: "Cota diária de destaques atingida", code: quota?.error ?? "quota_exceeded", limit: quota?.limit }, { status: 429 });
    const store = supabaseTranscriptStore(admin, { indexLines: true });
    let transcript = await store.get(key);
    if (!transcript) {
      const transcriptClaim = await admin.rpc("claim_transcript_quota", { p_user_id: session.userId, p_kind: "transcript" });
      if (transcriptClaim.error) throw transcriptClaim.error;
      const transcriptQuota = transcriptClaim.data as { ok?: boolean; error?: string; limit?: number } | null;
      if (!transcriptQuota?.ok) return NextResponse.json({ error: "Cota diária de transcrições atingida", code: transcriptQuota?.error ?? "quota_exceeded", limit: transcriptQuota?.limit }, { status: 429 });
      transcript = await getTranscript(source, { store });
    }
    const complete = process.env.GEMINI_API_KEY ? geminiComplete() : openAiCompatibleComplete();
    const highlights = await suggestHighlights(transcript, complete, {
      count, minSeconds, maxSeconds, signals,
      context: typeof b.context === "string" ? b.context.slice(0, 500) : undefined,
    });
    const createdAt = new Date().toISOString();
    if (cacheable) {
      const model = process.env.GEMINI_API_KEY ? (process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite") : (process.env.LLM_MODEL ?? null);
      const saved = await admin.from("video_highlights").upsert({
        source_key: key, params, prompt_version: HIGHLIGHT_PROMPT_VERSION, model,
        highlights: highlights as unknown as Json, created_by: session.userId, updated_at: createdAt,
      }, { onConflict: "source_key,params,prompt_version" });
      // Falha ao salvar não deve custar os destaques já gerados (e a cota já gasta).
      if (saved.error) console.error("video_highlights upsert", saved.error);
    }
    return NextResponse.json({ highlights, cached: false, createdAt });
  } catch (e) {
    const err = e instanceof TranscriptError ? e : new TranscriptError(e instanceof Error ? e.message : String(e), 500);
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
}
