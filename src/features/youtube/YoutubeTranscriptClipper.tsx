"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TranscriptPanel } from "@/features/editor/TranscriptPanel";
import type { Transcript } from "@/lib/transcript/client";
import type { Trim } from "@/lib/transcript/client";
import { createClient } from "@/lib/supabase/client";

export function YoutubeTranscriptClipper({ saved }: { saved: { id: string; videoId: string; title: string; channelTitle: string | null; durationMs: number | null; startMs: number | null; endMs: number | null } }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [trim, setTrim] = useState<Trim | null>(saved.startMs != null && saved.endMs != null ? { startMs: saved.startMs, endMs: saved.endMs, wordStart: 0, wordEnd: 0, text: "", warnings: [] } : null);
  const [saving, setSaving] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const sourceUrl = `/api/youtube/source?videoId=${encodeURIComponent(saved.videoId)}&audio=0`;

  // O atributo é aplicado via DOM para esconder o item Download do menu nativo.
  useEffect(() => {
    videoRef.current?.setAttribute("controlsList", "nodownload");
  }, []);

  async function openEditor() {
    if (!trim) return;
    setSaving(true);
    const supabase = createClient();
    const result = await supabase.from("youtube_saved_videos").update({ start_ms: trim.startMs, end_ms: trim.endMs, clip_text: trim.text, duration_ms: transcript?.durationMs ?? saved.durationMs, updated_at: new Date().toISOString() }).eq("id", saved.id);
    if (!result.error) router.push(`/youtube/clips/${saved.id}/editor`);
    else setSaving(false);
  }

  return <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 items-start max-[1000px]:grid-cols-1">
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video overflow-hidden rounded-md bg-black">
        <video ref={videoRef} src={sourceUrl} controls playsInline preload="metadata" onLoadStart={() => { setMediaLoading(true); setMediaError(null); }} onLoadedMetadata={() => setMediaLoading(false)} onCanPlay={() => setMediaLoading(false)} onError={() => { setMediaLoading(false); setMediaError("Não foi possível carregar o vídeo. Instale yt-dlp no servidor ou configure YTDLP_PATH/PYTHON_PATH."); }} className="absolute inset-0 h-full w-full" />
      </div>
      {mediaLoading && !mediaError && <LoadingModal text="Carregando o vídeo do YouTube…" />}
      {mediaError && <p className="text-[13px] text-danger">{mediaError}</p>}
      <div className="flex items-center gap-3 text-sm">
        {trim ? <><span className="text-muted">Recorte: {Math.round(trim.startMs / 1000)}s – {Math.round(trim.endMs / 1000)}s</span><Button variant="primary" onClick={openEditor} disabled={saving}>{saving ? "Abrindo…" : "Abrir no editor"}</Button></> : <span className="text-muted">Selecione um trecho na transcrição para continuar.</span>}
      </div>
    </div>
    <TranscriptPanel videoRef={videoRef} sourceUrl={`https://www.youtube.com/watch?v=${saved.videoId}`} transcript={transcript} onTranscript={setTranscript} onTrim={setTrim} autoLoad aiOnly />
  </div>;
}

function LoadingModal({ text }: { text: string }) {
  return <div role="status" aria-live="polite" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
    <div className="w-full max-w-sm rounded-lg border border-border-strong bg-surface p-5 shadow-2xl">
      <div className="flex items-center gap-3 text-sm font-medium text-fg">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-accent" aria-hidden />
        {text}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full w-2/5 animate-[loading_1.4s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
      <p className="mt-3 text-xs text-muted">A mídia pode levar alguns segundos para ser preparada.</p>
    </div>
    <style>{`@keyframes loading { 0% { transform: translateX(-125%); } 100% { transform: translateX(275%); } }`}</style>
  </div>;
}
