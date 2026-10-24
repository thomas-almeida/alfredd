"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TranscriptPanel } from "@/features/editor/TranscriptPanel";
import { HighlightsPanel } from "@/features/editor/HighlightsPanel";
import type { Transcript } from "@/lib/transcript/client";
import type { Trim } from "@/lib/transcript/client";
import { createClient } from "@/lib/supabase/client";
import { nextPreviewAttempt } from "@/lib/youtube/preview";

export function YoutubeTranscriptClipper({ saved }: { saved: { id: string; videoId: string; title: string; channelTitle: string | null; durationMs: number | null; startMs: number | null; endMs: number | null } }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [trim, setTrim] = useState<Trim | null>(saved.startMs != null && saved.endMs != null ? { startMs: saved.startMs, endMs: saved.endMs, wordStart: 0, wordEnd: 0, text: "", warnings: [] } : null);
  const [saving, setSaving] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const sourceUrl = `/api/youtube/source?videoId=${encodeURIComponent(saved.videoId)}&audio=0`;
  const fallbackSourceUrl = `/api/youtube/source?videoId=${encodeURIComponent(saved.videoId)}`;
  const [mediaSource, setMediaSource] = useState(sourceUrl);
  const [mediaRetry, setMediaRetry] = useState(0);
  const lastMediaErrorSource = useRef<string | null>(null);

  useEffect(() => {
    setMediaSource(sourceUrl);
    setMediaRetry(0);
  }, [sourceUrl]);

  function retryPreview() {
    setMediaError(null);
    setMediaLoading(true);
    setMediaRetry(1);
    lastMediaErrorSource.current = null;
    setMediaSource(`${sourceUrl}&refresh=1&retry=${Date.now()}`);
  }

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

  const youtubeUrl = `https://www.youtube.com/watch?v=${saved.videoId}`;

  return <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-x-5 gap-y-4 max-[1000px]:grid-cols-1">
    <div className="relative aspect-video overflow-hidden rounded-md bg-black">
      <video ref={videoRef} src={mediaSource} controls playsInline preload="metadata" onLoadStart={() => { setMediaLoading(true); setMediaError(null); }} onLoadedMetadata={() => setMediaLoading(false)} onCanPlay={() => setMediaLoading(false)} onError={() => {
        // O mesmo elemento pode emitir o erro antigo depois que src já mudou.
        // Não conte duas vezes o mesmo erro; caso contrário o proxy funciona,
        // mas o estado termina como "falhou".
        if (lastMediaErrorSource.current === mediaSource) return;
        lastMediaErrorSource.current = mediaSource;
        const next = nextPreviewAttempt(sourceUrl, fallbackSourceUrl, mediaRetry);
        if (next) {
          setMediaRetry(next.attempt);
          setMediaSource(next.url);
        } else {
          setMediaLoading(false);
          setMediaError("Não foi possível carregar a prévia do YouTube. O servidor pode estar sem yt-dlp/ffmpeg ou o vídeo pode estar temporariamente indisponível.");
        }
      }} className="absolute inset-0 h-full w-full" />
    </div>
    {/* O painel fica absoluto para que a altura da linha venha só do player. */}
    <div className="relative max-[1000px]:order-last max-[1000px]:h-[28rem]">
      <div className="absolute inset-0">
        <TranscriptPanel videoRef={videoRef} sourceUrl={youtubeUrl} transcript={transcript} onTranscript={setTranscript} onTrim={setTrim} autoLoad aiOnly showHighlights={false} fill />
      </div>
    </div>
    <div className="flex min-w-0 flex-col gap-4">
      {mediaLoading && !mediaError && <LoadingModal text="Carregando o vídeo do YouTube…" />}
      {mediaError && <div className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-danger">{mediaError}</p>
        <Button variant="secondary" size="sm" onClick={retryPreview}>Tentar novamente</Button>
      </div>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {trim ? <><span className="text-muted">Recorte: {Math.round(trim.startMs / 1000)}s – {Math.round(trim.endMs / 1000)}s</span><Button variant="primary" onClick={openEditor} disabled={saving}>{saving ? "Abrindo…" : "Abrir no editor"}</Button></> : <span className="text-muted">Escolha um destaque abaixo para continuar.</span>}
      </div>
      <HighlightsPanel videoRef={videoRef} sourceUrl={youtubeUrl} onTrim={setTrim} thumbnailUrl={`https://i.ytimg.com/vi/${saved.videoId}/mqdefault.jpg`} ready={transcript !== null} />
    </div>
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
