"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { TranscriptPanel } from "@/features/editor/TranscriptPanel";
import type { Transcript, Trim } from "@/lib/transcript/client";

// Espelha a resposta de /api/twitch/resolve (sem as URLs assinadas, que nunca chegam ao cliente).
type ClipOption = { quality: string; frameRate: number; codecs?: string };
type ClipInfo = {
  kind: "clip";
  slug: string;
  title: string;
  channel: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  createdAt: string;
  landscape: ClipOption[];
  portrait: ClipOption[];
};
type VodInfo = {
  kind: "vod";
  id: string;
  title: string;
  channel: string;
  lengthSeconds: number;
  createdAt: string;
  thumbnailUrl: string | null;
  variants: { name: string; resolution?: string; bandwidth?: number }[];
};
type Resolved = ClipInfo | VodInfo;

const inputCls =
  "h-[38px] px-3 rounded-sm bg-surface-2 border border-border text-[13px] text-fg placeholder:text-subtle focus:outline-none focus:border-border-strong";

function fmtTime(total: number): string {
  const t = Math.max(0, Math.floor(total));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function TwitchDownloader() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Resolved | null>(null);
  const [resolvedUrl, setResolvedUrl] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const link = url.trim();
    if (!link) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/twitch/resolve?url=${encodeURIComponent(link)}`);
      const json = (await res.json().catch(() => ({}))) as Partial<Resolved> & { error?: string };
      if (!res.ok || json.error) {
        setError(json.error ?? "Não foi possível consultar a Twitch.");
        return;
      }
      setData(json as Resolved);
      setResolvedUrl(link);
    } catch {
      setError("Falha de rede ao consultar a Twitch.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <form onSubmit={onSubmit} className="flex gap-3 max-[860px]:flex-col">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.twitch.tv/canal/clip/... ou https://www.twitch.tv/videos/..."
            aria-label="Link da Twitch"
            className={cn(inputCls, "flex-1")}
            required
          />
          <Button type="submit" variant="primary" disabled={loading || !url.trim()}>
            {loading ? "Consultando…" : "Buscar"}
          </Button>
        </form>
        <p className="mt-3 text-[12px] text-subtle">
          Aceita links de clipes (clips.twitch.tv ou /clip/) e de VODs (/videos/). Use apenas conteúdo
          que você tem direito de usar.
        </p>
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {error}
          </p>
        )}
      </Card>

      {data?.kind === "clip" && <ClipPanel key={data.slug} clip={data} sourceUrl={resolvedUrl} />}
      {data?.kind === "vod" && <VodPanel key={data.id} vod={data} sourceUrl={resolvedUrl} />}
    </div>
  );
}

function ClipPanel({ clip, sourceUrl }: { clip: ClipInfo; sourceUrl: string }) {
  const mediaUrl = useMemo(
    () => `/api/twitch/download?${new URLSearchParams({ url: sourceUrl, dl: "0" }).toString()}`,
    [sourceUrl],
  );

  return <TwitchTranscriptMedia
    sourceUrl={sourceUrl}
    mediaUrl={mediaUrl}
    title={clip.title}
    channel={clip.channel}
    durationMs={clip.durationSeconds * 1000}
  />;
}

function VodPanel({ vod, sourceUrl }: { vod: VodInfo; sourceUrl: string }) {
  const mediaUrl = useMemo(() => {
    const p = new URLSearchParams({
      url: sourceUrl,
      start: "0",
      end: String(vod.lengthSeconds),
      dl: "0",
    });
    return `/api/twitch/download?${p.toString()}`;
  }, [sourceUrl, vod.lengthSeconds]);

  return <TwitchTranscriptMedia
    key={mediaUrl}
    sourceUrl={sourceUrl}
    mediaUrl={mediaUrl}
    title={vod.title}
    channel={vod.channel}
    durationMs={vod.lengthSeconds * 1000}
    transcriptWindow={{ startMs: 0, endMs: vod.lengthSeconds * 1000 }}
  />;
}

function TwitchTranscriptMedia({
  sourceUrl,
  mediaUrl,
  title,
  channel,
  durationMs,
  transcriptWindow,
  timeOffsetMs = 0,
}: {
  sourceUrl: string;
  mediaUrl: string;
  title: string;
  channel: string;
  durationMs: number;
  transcriptWindow?: { startMs: number; endMs: number };
  timeOffsetMs?: number;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [trim, setTrim] = useState<Trim | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  const editorUrl = useMemo(() => {
    const p = new URLSearchParams({ url: sourceUrl, duration: String(durationMs / 1000), title, channel });
    if (trim) {
      const base = transcriptWindow?.startMs ?? 0;
      p.set("start", String(base / 1000 + trim.startMs / 1000));
      p.set("end", String(base / 1000 + trim.endMs / 1000));
    }
    return `/twitch/editor?${p.toString()}`;
  }, [sourceUrl, durationMs, title, channel, transcriptWindow, trim]);

  function selectWholeVideo() {
    setTrim({
      startMs: 0,
      endMs: durationMs,
      wordStart: 0,
      wordEnd: Math.max(0, (transcript?.words?.length ?? 0) - 1),
      text: "Vídeo inteiro",
      warnings: [],
    });
  }

  return <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-5 items-start max-[1000px]:grid-cols-1">
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold text-fg break-words">{title}</h2>
        <p className="mt-1 text-sm text-muted">{channel} · selecione um destaque para abrir no editor</p>
      </div>
      <div className="relative">
        <video
          ref={videoRef}
          src={mediaUrl}
          controls
          playsInline
          preload="auto"
          onTimeUpdate={(event) => setPreviewTime(event.currentTarget.currentTime)}
          className="w-full rounded-md bg-black"
        />
        {transcript && <PreviewCaption transcript={transcript} currentTime={previewTime} timeOffsetMs={timeOffsetMs} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-accent/30 bg-accent/10 p-3">
        {trim ? (
          <span className="text-xs text-muted">
            Trecho selecionado: <strong className="text-fg">{fmtTime(trim.endMs / 1000 - trim.startMs / 1000)}</strong>
          </span>
        ) : (
          <span className="text-sm text-muted">Escolha um destaque ou use o vídeo inteiro.</span>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={selectWholeVideo}>Clipar vídeo inteiro</Button>
          {trim && <Button variant="primary" onClick={() => router.push(editorUrl)}>Abrir no editor</Button>}
        </div>
      </div>
    </div>
    <TranscriptPanel
      videoRef={videoRef}
      sourceUrl={sourceUrl}
      transcript={transcript}
      onTranscript={setTranscript}
      onTrim={setTrim}
      autoLoad
      aiOnly
      transcriptWindow={transcriptWindow}
      timeOffsetMs={timeOffsetMs}
    />
  </div>;
}

function PreviewCaption({ transcript, currentTime, timeOffsetMs }: { transcript: Transcript; currentTime: number; timeOffsetMs: number }) {
  const now = currentTime * 1000 + timeOffsetMs;
  const line = transcript.lines.find((item, index) => {
    const nextStart = transcript.lines[index + 1]?.startMs ?? Infinity;
    return now >= item.startMs && (now < item.endMs || now < nextStart);
  });
  if (!line) return null;
  return <div className="pointer-events-none absolute inset-x-4 bottom-12 z-10 flex justify-center">
    <span className="max-w-[90%] rounded bg-black/80 px-3 py-1.5 text-center text-sm font-semibold leading-snug text-white shadow-lg">
      {line.text}
    </span>
  </div>;
}
