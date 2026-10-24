import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  TranscriptError, getTranscript, geminiComplete, openAiCompatibleComplete, parseSource,
  sourceKey, suggestHighlights, supabaseTranscriptStore, type Signal,
} from "@/lib/transcript";

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
    };
    const startMs = typeof b.startMs === "number" ? b.startMs : undefined;
    const endMs = typeof b.endMs === "number" ? b.endMs : undefined;
    const source = parseSource(typeof b.url === "string" ? b.url : "", startMs !== undefined && endMs !== undefined ? { startMs, endMs } : undefined);
    if (!source) return NextResponse.json({ error: "Link de YouTube ou Twitch inválido", code: "invalid_source" }, { status: 400 });
    const admin = createAdminClient();
    const claim = await admin.rpc("claim_transcript_quota", { p_user_id: session.userId, p_kind: "highlights" });
    if (claim.error) throw claim.error;
    const quota = claim.data as { ok?: boolean; error?: string; limit?: number; used?: number } | null;
    if (!quota?.ok) return NextResponse.json({ error: "Cota diária de destaques atingida", code: quota?.error ?? "quota_exceeded", limit: quota?.limit }, { status: 429 });
    const store = supabaseTranscriptStore(admin, { indexLines: true });
    const key = sourceKey(source);
    let transcript = await store.get(key);
    if (!transcript) {
      const transcriptClaim = await admin.rpc("claim_transcript_quota", { p_user_id: session.userId, p_kind: "transcript" });
      if (transcriptClaim.error) throw transcriptClaim.error;
      const transcriptQuota = transcriptClaim.data as { ok?: boolean; error?: string; limit?: number } | null;
      if (!transcriptQuota?.ok) return NextResponse.json({ error: "Cota diária de transcrições atingida", code: transcriptQuota?.error ?? "quota_exceeded", limit: transcriptQuota?.limit }, { status: 429 });
      transcript = await getTranscript(source, { store });
    }
    const n = typeof b.count === "number" ? Math.max(1, Math.min(10, Math.round(b.count))) : undefined;
    const complete = process.env.GEMINI_API_KEY ? geminiComplete() : openAiCompatibleComplete();
    const highlights = await suggestHighlights(transcript, complete, {
      count: n,
      minSeconds: typeof b.minSeconds === "number" ? Math.max(5, Math.min(90, b.minSeconds)) : undefined,
      maxSeconds: typeof b.maxSeconds === "number" ? Math.max(10, Math.min(90, b.maxSeconds)) : undefined,
      context: typeof b.context === "string" ? b.context.slice(0, 500) : undefined,
      signals: Array.isArray(b.signals) ? b.signals as Signal[] : undefined,
    });
    return NextResponse.json({ highlights });
  } catch (e) {
    const err = e instanceof TranscriptError ? e : new TranscriptError(e instanceof Error ? e.message : String(e), 500);
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
}
