"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useEditor } from "@/lib/editor/store";
import {
  CAM_H,
  OUT_H,
  OUT_W,
  centeredCrop,
  cropToPixels,
  cropsAt,
  inSegments,
  keyframeIndexAt,
  lockAspect,
  nextPlayable,
  outputSegments,
  segmentIndexAt,
  slotsFor,
  compositionAt,
  framingAt,
  type EditorState,
  type Framing,
  type Layout,
  type NRect,
} from "@/lib/export/layouts";
import type { ClipStatus, Json } from "@/lib/supabase/database.types";
import { ClipStatusBadge } from "./ClipStatusBadge";
import { MOTION_PRESETS, camRectFromFaces, detectPeaks, rmsEnvelope } from "@/lib/editor/motion";
import { EditorLoader, type LoaderStep } from "./EditorLoader";
import { VideoLoadingOverlay, type VideoState } from "./VideoLoadingOverlay";
import { ExportPanel } from "./ExportPanel";
import { LeaveGuard } from "./LeaveGuard";
import { Icon } from "@/components/ui/Icon";
import { Timeline, type Selection } from "./Timeline";
import { nextClip } from "./actions";
import { TranscriptPanel } from "./TranscriptPanel";
import { windowTranscript, type Transcript } from "@/lib/transcript/client";

/** Folga em volta do trecho escolhido, para o usuário poder ajustar o corte. */
const CLIP_MARGIN_MS = 60_000;
const DEFAULT_CAPTION_POSITION = { x: 0.5, y: 0.88 };

const FOCUS_COLORS = ["#22d3ee", "#fbbf24", "#c084fc", "#fb7185"];

type SlotKey = "game" | "cam";
type Ingest = {
  clipId: string;
  channel: string | null;
  status: ClipStatus;
  duration: number;
  /** Proxy same-origin do MP4 da Twitch (Range), usado no <video> e no export. */
  sourceUrl: string;
  /** Status da preparação da mídia no servidor (só YouTube). */
  progressUrl?: string;
  persist: boolean;
};

export type YoutubeEditorInput = {
  savedId: string;
  videoId: string;
  title: string;
  channel: string | null;
  durationMs: number;
  startMs: number | null;
  endMs: number | null;
};

export type ExternalEditorInput = {
  sourceUrl: string;
  /** URL pública original, usada para resolver a transcrição. */
  transcriptUrl?: string;
  transcriptWindow?: { startMs: number; endMs: number };
  title: string;
  channel: string | null;
  durationMs: number;
  startMs?: number;
  endMs?: number;
};

type Phase = "ingest" | "project";

const INGEST_ERRORS: Record<string, string> = {
  too_long: "O clipe tem mais de 90 s, limite do MVP.",
  unauthenticated: "Entre na sua conta para editar clipes.",
  clip_not_found: "Clipe não encontrado na Twitch.",
};

/** Proporção (w/h) do slot de destino de cada crop. */
/** Campo do enquadramento da faixa ativa. */
function useFraming<K extends keyof Framing>(key: K): Framing[K] {
  return useEditor((s) => ((s.activeTrack > 0 && s.tracks?.[s.activeTrack - 1]) || s)[key]);
}

function slotAspect(layout: Layout, key: SlotKey) {
  const s = slotsFor(layout).find((x) => x.key === key);
  return s ? { w: s.dw, h: s.dh } : { w: OUT_W, h: CAM_H };
}

export function ClipEditor({
  twitchId,
  userId,
  title,
  youtube,
  external,
}: {
  twitchId: string;
  userId: string;
  title: string;
  youtube?: YoutubeEditorInput;
  external?: ExternalEditorInput;
}) {
  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ingest");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const init = useEditor((s) => s.init);

  // YouTube com trecho salvo: o servidor corta só o trecho + margem, e o editor
  // trabalha em tempos relativos a essa janela.
  const ytStart = youtube?.startMs;
  const ytEnd = youtube?.endMs;
  const ytDuration = youtube?.durationMs;
  const youtubeWindow = useMemo(() => ytStart != null && ytEnd != null && ytDuration != null && ytEnd > ytStart
    ? { startMs: Math.max(0, Math.round(ytStart - CLIP_MARGIN_MS)), endMs: Math.round(Math.min(Math.max(ytDuration, ytEnd), ytEnd + CLIP_MARGIN_MS)) }
    : undefined, [ytStart, ytEnd, ytDuration]);
  const extStart = external?.transcriptWindow?.startMs;
  const extEnd = external?.transcriptWindow?.endMs;
  const transcriptWindow = useMemo(() => extStart != null && extEnd != null ? { startMs: extStart, endMs: extEnd } : youtubeWindow, [extStart, extEnd, youtubeWindow]);

  // Ingestão do MP4 + carga do projeto salvo.
  useEffect(() => {
    let alive = true;
    (async () => {
      const w = !external ? youtubeWindow : undefined;
      const query = youtube ? `videoId=${encodeURIComponent(youtube.videoId)}${w ? `&start=${w.startMs}&end=${w.endMs}` : ""}` : "";
      const externalSource = external ?? (youtube ? {
        sourceUrl: `/api/youtube/source?${query}`,
        title: youtube.title,
        channel: youtube.channel,
        durationMs: w ? w.endMs - w.startMs : youtube.durationMs,
        startMs: (youtube.startMs ?? 0) - (w?.startMs ?? 0),
        endMs: (youtube.endMs ?? youtube.durationMs) - (w?.startMs ?? 0),
      } : null);
      if (externalSource) {
        const duration = externalSource.durationMs / 1000;
        const start = (externalSource.startMs ?? 0) / 1000;
        const end = (externalSource.endMs ?? externalSource.durationMs) / 1000;
        init(duration, { segments: [{ start, end }] });
        setPhase("project");
        const progressUrl = !external && youtube ? `/api/youtube/source?${query}&progress=1` : undefined;
        setIngest({ clipId: "external", channel: externalSource.channel, status: "novo", duration, sourceUrl: externalSource.sourceUrl, progressUrl, persist: false });
        return;
      }
      const res = await fetch(`/api/clips/${twitchId}/ingest`, { method: "POST" });
      const json = (await res.json()) as Ingest & { error?: string };
      if (!alive) return;
      if (!res.ok) {
        setError(INGEST_ERRORS[json.error ?? ""] ?? `Falha ao preparar o clipe (${json.error}).`);
        return;
      }
      setPhase("project");
      const supabase = createClient();
      const { data } = await supabase
        .from("clip_projects")
        .select("state")
        .eq("clip_id", json.clipId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!alive) return;
      init(json.duration, (data?.state as Partial<EditorState> | null) ?? null);
      setIngest({ ...json, persist: true });
    })().catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [twitchId, userId, init, youtube, external, youtubeWindow]);

  // Autosave com debounce de 1 s; primeira edição marca o clipe como em edição.
  useEffect(() => {
    if (!ingest?.persist) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let marked = ingest.status !== "novo";
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.segments === prev.segments && s.layout === prev.layout && s.camPos === prev.camPos && s.crops === prev.crops && s.keyframes === prev.keyframes && s.audio === prev.audio && s.tracks === prev.tracks && s.composition === prev.composition && s.captionPosition === prev.captionPosition) return;
      clearTimeout(timer);
      setSaving("saving");
      timer = setTimeout(async () => {
        await supabase.from("clip_projects").upsert(
          {
            clip_id: ingest.clipId,
            user_id: userId,
            state: useEditor.getState().snapshot() as unknown as Json,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "clip_id,user_id" },
        );
        if (!marked) {
          marked = true;
          await supabase.rpc("set_clip_status", {
            p_clip_id: ingest.clipId,
            p_status: "em_edicao",
          });
        }
        setSaving("saved");
      }, 1000);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [ingest, userId]);

  if (error) {
    return (
      <div className="flex flex-col gap-3 items-start">
        <p className="text-danger">{error}</p>
        <Link href={`/clipes/${twitchId}`}>
          <Button variant="secondary">Voltar ao clipe</Button>
        </Link>
      </div>
    );
  }
  if (!ingest) {
    const at = phase === "ingest" ? 0 : 1;
    const st = (i: number): LoaderStep["state"] => (i < at ? "done" : i === at ? "active" : "todo");
    return (
      <EditorLoader
        title="Preparando o clipe…"
        progress={null}
        steps={[
          { label: "Salvando o clipe na sua biblioteca", state: st(0) },
          { label: "Carregando seu projeto", state: st(1) },
        ]}
      />
    );
  }

  return (
    <EditorBody
      ingest={ingest}
      userId={userId}
      title={title}
      transcriptUrl={external?.transcriptUrl ?? (youtube ? `https://www.youtube.com/watch?v=${youtube.videoId}` : `https://clips.twitch.tv/${twitchId}`)}
      transcriptWindow={transcriptWindow}
      saving={saving}
    />
  );
}

function EditorBody({
  ingest,
  userId,
  title,
  transcriptUrl,
  transcriptWindow,
  saving,
}: {
  ingest: Ingest;
  userId: string;
  title: string;
  transcriptUrl: string;
  transcriptWindow?: { startMs: number; endMs: number };
  saving: "idle" | "saving" | "saved";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loop, setLoop] = useState(true);
  const [selected, setSelected] = useState<Selection>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [src, setSrc] = useState({ w: 1920, h: 1080 });
  const [videoState, setVideoState] = useState<VideoState>("loading");
  const playing = useEditor((s) => s.playing);
  const router = useRouter();
  const [nextPending, startNext] = useTransition();
  const [noNext, setNoNext] = useState(false);
  const [exported, setExported] = useState(ingest.status === "exportado");
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  // Transcrição recortada e em tempos relativos ao arquivo servido.
  const windowStart = transcriptWindow?.startMs;
  const windowEnd = transcriptWindow?.endMs;
  const editorTranscript = useMemo(() => transcript && windowStart != null && windowEnd != null
    ? windowTranscript(transcript, { startMs: windowStart, endMs: windowEnd })
    : transcript, [transcript, windowStart, windowEnd]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.playbackRate = rate;
  }, [volume, rate, ingest]);

  // Mantém currentTime/playing no store e respeita o trim (loop opcional).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      const st = useEditor.getState();
      const { audio, setTime } = st;
      const segments = outputSegments(st);
      // Áudio desvinculado: silencia fora dos trechos de áudio.
      v.muted = mutedRef.current || (audio != null && !inSegments(audio, v.currentTime));
      // Pula os buracos entre segmentos; ao fim, volta ao início (loop) ou pausa.
      if (!v.seeking && !v.paused) {
        const next = nextPlayable(segments, v.currentTime);
        if (next === null) {
          if (loop) v.currentTime = segments[0]!.start;
          else {
            v.pause();
          }
        } else if (next > v.currentTime + 0.01) v.currentTime = next;
      }
      setTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onPlay = () => useEditor.getState().setPlaying(true);
    const onPause = () => useEditor.getState().setPlaying(false);
    const onMeta = () => {
      if (v.videoWidth) setSrc({ w: v.videoWidth, h: v.videoHeight });
      v.currentTime = outputSegments(useEditor.getState())[0]!.start;
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, [loop]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const segments = outputSegments(useEditor.getState());
    if (v.paused) {
      v.currentTime = nextPlayable(segments, v.currentTime) ?? segments[0]!.start;
      // play() rejeita com AbortError se um pause() chegar antes de começar; é esperado.
      v.play().catch(() => {});
    } else v.pause();
  }, []);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(t, ingest.duration));
  }, [ingest.duration]);

  // Atalhos: espaço play/pause, I/O marcam início/fim, L loop, setas navegam.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const st = useEditor.getState();
      const v = videoRef.current;
      const t = v?.currentTime ?? st.currentTime;
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) st.undo();
        else if (k === "y" || (k === "z" && e.shiftKey)) st.redo();
        else return;
        e.preventDefault();
        return;
      }
      const cur = segmentIndexAt(st.segments, t);
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "i":
        case "I":
          if (cur >= 0) st.setSegmentEdge(cur, "start", t);
          break;
        case "o":
        case "O":
          if (cur >= 0) st.setSegmentEdge(cur, "end", t);
          break;
        case "s":
        case "S":
          if (selected?.track === "audio" && st.audio) st.splitAudio(t);
          else st.split(t);
          break;
        case "Delete":
        case "Backspace": {
          if (selected?.track === "audio" && st.audio) {
            st.removeAudioAt(selected.i);
            setSelected(null);
            break;
          }
          const i = selected?.i ?? cur;
          if (i >= 0) {
            st.removeAt(i);
            setSelected(null);
          }
          break;
        }
        case "j":
        case "J":
          seek(t - 1);
          break;
        case "k":
        case "K":
          if (v) {
            v.pause();
            v.playbackRate = 1;
          }
          break;
        case "l":
        case "L":
          if (v) {
            // Cada L acelera: 1× → 2× → 4×.
            if (v.paused) v.playbackRate = 1;
            else v.playbackRate = Math.min(4, v.playbackRate * 2);
            if (v.paused) togglePlay();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(t - (e.shiftKey ? 1 : 1 / 30));
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(t + (e.shiftKey ? 1 : 1 / 30));
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seek, selected]);

  function goNext() {
    if (!ingest.persist) return;
    setNoNext(false);
    startNext(async () => {
      const id = await nextClip(ingest.clipId);
      if (id) router.push(`/clipes/${id}/editor`);
      else setNoNext(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        {ingest.persist && <ClipStatusBadge clipId={ingest.clipId} initial={ingest.status} />}
        <span className="text-[13px] text-muted">
          {saving === "saving" ? "Salvando…" : saving === "saved" ? "Alterações salvas" : ""}
        </span>
        <div className="ml-auto flex gap-2">
          <ExportPanel
            clipId={ingest.clipId}
            persist={ingest.persist}
            userId={userId}
            sourceUrl={ingest.sourceUrl}
            transcript={editorTranscript}
            captionsEnabled={captionsEnabled}
            fileName={`${(ingest.channel ?? "clip").replace(/\W+/g, "_")}-${title.slice(0, 40).replace(/\W+/g, "_")}.mp4`}
            onExported={() => setExported(true)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm("Reiniciar a edição do zero? Cortes, faixas de câmera, crops e keyframes voltam ao padrão. Dá para desfazer com Ctrl+Z."))
                useEditor.getState().resetEdit();
            }}
          >
            Reiniciar edição
          </Button>
          {ingest.persist && <Button variant="ghost" size="sm" onClick={goNext} disabled={nextPending}>
            {nextPending ? "Buscando…" : "Próximo clip →"}
          </Button>}
        </div>
      </div>
      {noNext && (
        <p className="text-[13px] text-muted">
          Nenhum outro clipe novo na sua biblioteca.
        </p>
      )}

      <div className="grid grid-cols-[minmax(250px,300px)_minmax(0,1fr)_minmax(250px,300px)] gap-5 items-start max-[1200px]:grid-cols-[280px_minmax(0,1fr)] max-[700px]:grid-cols-1">
        <aside className="sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto max-[700px]:static max-[700px]:max-h-none">
          <TranscriptPanel
            videoRef={videoRef}
            sourceUrl={transcriptUrl}
            transcript={transcript}
            onTranscript={setTranscript}
            autoLoad
            transcriptWindow={transcriptWindow}
            timeOffsetMs={transcriptWindow?.startMs ?? 0}
            showHighlights={false}
            tall
            onTrim={(trim) => useEditor.getState().setSegments([{ start: trim.startMs / 1000, end: trim.endMs / 1000 }])}
          />
        </aside>

        <div className="flex flex-col gap-3">
          <div
            className="relative bg-black rounded-md overflow-hidden select-none"
            style={{ aspectRatio: `${src.w} / ${src.h}` }}
          >
            <video
              ref={videoRef}
              src={ingest.sourceUrl}
              crossOrigin="anonymous"
              playsInline
              preload="auto"
              className="absolute inset-0 w-full h-full"
              onClick={togglePlay}
              onLoadStart={() => setVideoState("loading")}
              onLoadedData={() => setVideoState("ready")}
              onCanPlay={() => setVideoState("ready")}
              onPlaying={() => setVideoState("ready")}
              onWaiting={() => setVideoState((s) => (s === "ready" ? "buffering" : s))}
              onError={() => setVideoState("error")}
            />
          <FocusOverlay srcW={src.w} srcH={src.h} />
          <VideoLoadingOverlay state={videoState} progressUrl={ingest.progressUrl} durationMs={ingest.duration * 1000} />
          </div>
          <Timeline
            duration={ingest.duration}
            sourceUrl={ingest.sourceUrl}
            selected={selected}
            onSelect={setSelected}
            onSeek={seek}
            playing={playing}
            onTogglePlay={togglePlay}
            loop={loop}
            onToggleLoop={() => setLoop((l) => !l)}
            rate={rate}
            onRate={setRate}
          />
          <div className="flex items-center gap-2 flex-wrap text-[13px] text-muted">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Ativar som" : "Silenciar"}
                className="w-6 text-center hover:text-text"
              >
                <Icon name={muted || volume === 0 ? "volume-off" : "volume"} width={16} height={16} />

              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setMuted(false);
                }}
                aria-label="Volume"
                className="w-24 accent-twitch"
              />
              <span className="w-9 tabular-nums">{Math.round((muted ? 0 : volume) * 100)}%</span>
            </div>
            <button
              type="button"
              onClick={() => setCaptionsEnabled((v) => !v)}
              disabled={!transcript}
              aria-pressed={captionsEnabled}
              aria-label={!transcript ? "Carregue a transcrição para ativar as legendas" : captionsEnabled ? "Desativar legendas" : "Ativar legendas"}
              title={!transcript ? "Carregue a transcrição primeiro" : captionsEnabled ? "Desativar legendas" : "Ativar legendas"}
              className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 transition-colors ${captionsEnabled ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
            >
              <Icon name="subtitles" width={16} height={16} />
              <span className="text-xs">Legendas</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto max-[1200px]:col-span-2 max-[700px]:col-span-1 max-[700px]:static max-[700px]:max-h-none">
          <VerticalPreview videoRef={videoRef} srcW={src.w} srcH={src.h} transcript={editorTranscript} captionsEnabled={captionsEnabled} />
          <FocusLayoutPicker srcW={src.w} srcH={src.h} />
          <KeyframeControls />
          <MotionControls videoRef={videoRef} sourceUrl={ingest.sourceUrl} srcW={src.w} srcH={src.h} />
          <LeaveGuard active={!exported} />
        </div>
      </div>
    </div>
  );
}

function FocusOverlay({ srcW, srcH }: { srcW: number; srcH: number }) {
  const state = useEditor();
  const panes = state.composition ?? compositionAt(state, state.currentTime);
  const { activePaneId, setActivePane, setPaneCrop } = state;
  const boxRef = useRef<HTMLDivElement>(null);

  function drag(e: React.PointerEvent, paneId: string, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    const pane = panes.find((item) => item.id === paneId);
    if (!box || !pane) return;
    setActivePane(paneId);
    const start = { x: e.clientX, y: e.clientY, r: pane.crop };
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / box.width;
      const dy = (ev.clientY - start.y) / box.height;
      if (mode === "move") {
        setPaneCrop(paneId, { ...start.r, x: start.r.x + dx, y: start.r.y + dy });
      } else {
        const r: NRect = { ...start.r, w: Math.max(0.05, start.r.w + dx) };
        setPaneCrop(paneId, lockAspect(r, srcW, srcH, pane.destination.w * OUT_W, pane.destination.h * OUT_H));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function recenter(pane: (typeof panes)[number]) {
    const r = pane.crop;
    const fit = centeredCrop(srcW, srcH, pane.destination.w * OUT_W, pane.destination.h * OUT_H);
    const w = Math.min(r.w, fit.w);
    const sized = lockAspect({ x: 0, y: 0, w, h: r.h }, srcW, srcH, pane.destination.w * OUT_W, pane.destination.h * OUT_H);
    setPaneCrop(pane.id, { ...sized, x: (1 - sized.w) / 2, y: (1 - sized.h) / 2 });
  }

  return (
    <div ref={boxRef} className="absolute inset-0 pointer-events-none">
      {panes.map((pane, index) => {
        const r = pane.crop;
        const isActive = pane.id === activePaneId;
        const color = FOCUS_COLORS[index % FOCUS_COLORS.length]!;
        return (
          <div
            key={pane.id}
            className={`absolute border-2 pointer-events-auto cursor-move ${isActive ? "border-accent" : "border-white/40"}`}
            style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%`, borderColor: color, opacity: isActive ? 1 : 0.72, boxShadow: isActive ? `0 0 0 9999px rgba(0,0,0,0.45), 0 0 0 2px ${color}55` : undefined, zIndex: isActive ? 2 : 1 }}
            onPointerDown={(e) => drag(e, pane.id, "move")}
            onDoubleClick={() => recenter(pane)}
          >
            <span className="absolute left-1 top-1 text-[11px] text-black font-semibold px-1 rounded-sm" style={{ backgroundColor: color }}>{`Foco ${index + 1}`}</span>
            <div className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-sm cursor-nwse-resize" style={{ backgroundColor: color }} onPointerDown={(e) => drag(e, pane.id, "resize")} />
          </div>
        );
      })}
    </div>
  );
}

function CropOverlay({
  activeKey,
  srcW,
  srcH,
}: {
  activeKey: SlotKey;
  srcW: number;
  srcH: number;
}) {
  const layout = useFraming("layout");
  // Crops visíveis no instante atual (interpolados quando há keyframes).
  const baseCrops = useFraming("crops");
  const keyframes = useFraming("keyframes");
  const currentTime = useEditor((s) => s.currentTime);
  const crops = cropsAt({ crops: baseCrops, keyframes }, currentTime);
  const setCrop = useEditor((s) => s.setCrop);
  const boxRef = useRef<HTMLDivElement>(null);

  function drag(e: React.PointerEvent, key: SlotKey, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const start = { x: e.clientX, y: e.clientY, r: cropsAt(useEditor.getState().activeFraming(), useEditor.getState().currentTime)[key] };
    const asp = slotAspect(layout, key);
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.x) / box.width;
      const dy = (ev.clientY - start.y) / box.height;
      if (mode === "move") {
        setCrop(key, { ...start.r, x: start.r.x + dx, y: start.r.y + dy });
      } else {
        const r: NRect = { ...start.r, w: Math.max(0.05, start.r.w + dx) };
        setCrop(key, lockAspect(r, srcW, srcH, asp.w, asp.h));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function recenter(key: SlotKey) {
    const asp = slotAspect(layout, key);
    const r = crops[key];
    const fit = centeredCrop(srcW, srcH, asp.w, asp.h);
    // Mantém o tamanho atual quando cabe; senão usa o maior encaixe centralizado.
    const w = Math.min(r.w, fit.w);
    const sized = lockAspect({ x: 0, y: 0, w, h: r.h }, srcW, srcH, asp.w, asp.h);
    setCrop(key, { ...sized, x: (1 - sized.w) / 2, y: (1 - sized.h) / 2 });
  }

  const keys: SlotKey[] = layout === "full" ? ["game"] : ["game", "cam"];
  return (
    <div ref={boxRef} className="absolute inset-0 pointer-events-none">
      {keys.map((key) => {
        const r = crops[key];
        const isActive = key === activeKey;
        return (
          <div
            key={key}
            className={`absolute border-2 pointer-events-auto cursor-move ${
              isActive ? "border-accent" : "border-white/40"
            }`}
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
              boxShadow: isActive ? "0 0 0 9999px rgba(0,0,0,0.45)" : undefined,
              zIndex: isActive ? 2 : 1,
            }}
            onPointerDown={(e) => drag(e, key, "move")}
            onDoubleClick={() => recenter(key)}
          >
            <span className="absolute left-1 top-1 text-[11px] bg-black/60 text-white px-1 rounded-sm">
              {key === "game" ? "Jogo" : "Cam"}
            </span>
            <div
              className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-accent rounded-sm cursor-nwse-resize"
              onPointerDown={(e) => drag(e, key, "resize")}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Preview 9:16 desenhado em canvas a partir do <video>, com os mesmos slots do export. */
function VerticalPreview({
  videoRef,
  srcW,
  srcH,
  transcript,
  captionsEnabled,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  srcW: number;
  srcH: number;
  transcript: Transcript | null;
  captionsEnabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const PW = 270;
  const PH = (PW * OUT_H) / OUT_W;
  const captionPosition = useEditor((s) => s.captionPosition ?? DEFAULT_CAPTION_POSITION);
  const setCaptionPosition = useEditor((s) => s.setCaptionPosition);
  const currentTime = useEditor((s) => s.currentTime);
  const currentLine = transcript?.lines.find((item, index) => {
    const nextStart = transcript.lines[index + 1]?.startMs ?? Infinity;
    return currentTime * 1000 >= item.startMs && (currentTime * 1000 < item.endMs || currentTime * 1000 < nextStart);
  });

  function dragCaption(e: React.PointerEvent) {
    e.preventDefault();
    const box = frameRef.current?.getBoundingClientRect();
    if (!box) return;
    const onMove = (event: PointerEvent) => setCaptionPosition({
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    });
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    const c = canvasRef.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    let raf = 0;
    const draw = () => {
      const v = videoRef.current;
      const state = useEditor.getState();
      g.fillStyle = "#000";
      g.fillRect(0, 0, PW, PH);
      if (v && v.readyState >= 2) {
        for (const pane of compositionAt(state, v?.currentTime ?? 0).sort((a, b) => a.zIndex - b.zIndex)) {
          const p = cropToPixels(pane.crop, v.videoWidth || srcW, v.videoHeight || srcH);
          const d = pane.destination;
          g.drawImage(v, p.sx, p.sy, p.sw, p.sh, d.x * PW, d.y * PH, d.w * PW, d.h * PH);
        }

        if (captionsEnabled && transcript) {
          const now = (v.currentTime ?? 0) * 1000;
          const line = transcript.lines.find((item, index) => {
            const nextStart = transcript.lines[index + 1]?.startMs ?? Infinity;
            return now >= item.startMs && (now < item.endMs || now < nextStart);
          });
          if (line) {
            g.font = "600 12px sans-serif";
            g.textAlign = "center";
            g.textBaseline = "middle";
            const maxWidth = PW - 28;
            const words = line.text.split(/\s+/);
            const rows: string[] = [];
            let row = "";
            for (const word of words) {
              const candidate = row ? `${row} ${word}` : word;
              if (row && g.measureText(candidate).width > maxWidth) {
                rows.push(row);
                row = word;
              } else {
                row = candidate;
              }
            }
            if (row) rows.push(row);
            const lineHeight = 16;
            const boxHeight = rows.length * lineHeight + 12;
            const statePosition = state.captionPosition ?? DEFAULT_CAPTION_POSITION;
            const boxY = statePosition.y * PH - boxHeight / 2;
            const boxX = statePosition.x * PW - (PW - 20) / 2;
            g.fillStyle = "rgba(0, 0, 0, 0.82)";
            g.fillRect(boxX, boxY, PW - 20, boxHeight);
            g.fillStyle = "#fff";
            rows.forEach((row, index) => g.fillText(row, statePosition.x * PW, boxY + 6 + index * lineHeight + lineHeight / 2));
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, srcW, srcH, PH, transcript, captionsEnabled]);

  return (
    <div ref={frameRef} className="relative self-center" style={{ width: PW, height: PH }}>
      <canvas ref={canvasRef} width={PW} height={PH} className="rounded-md border border-border bg-black" style={{ width: PW, height: PH }} />
      {captionsEnabled && currentLine && (
        <div
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-move rounded border-2 border-amber-400 px-2 py-1 text-[10px] font-semibold text-amber-100 bg-black/35"
          style={{ left: `${captionPosition.x * 100}%`, top: `${captionPosition.y * 100}%` }}
          onPointerDown={dragCaption}
          title="Arraste para posicionar a legenda"
        >
          Legenda
        </div>
      )}
    </div>
  );
}

/** Liga/desliga o keyframe de crop no instante atual da faixa ativa. */
function KeyframeControls() {
  const keyframes = useFraming("keyframes");
  const currentTime = useEditor((s) => s.currentTime);
  const addKeyframe = useEditor((s) => s.addKeyframe);
  const removeKeyframe = useEditor((s) => s.removeKeyframe);
  const clearKeyframes = useEditor((s) => s.clearKeyframes);
  const here = keyframeIndexAt(keyframes, currentTime) >= 0;
  const count = keyframes?.length ?? 0;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted">Keyframes de enquadramento</span>
      <div className="flex gap-2 items-center">
        <Button size="sm" variant={here ? "primary" : "secondary"} onClick={here ? removeKeyframe : addKeyframe}>
          {here ? "Remover keyframe" : "Adicionar keyframe"}
        </Button>
        {count > 0 && (
          <Button size="sm" variant="ghost" onClick={clearKeyframes}>
            Limpar
          </Button>
        )}
        <span className="text-[12px] text-muted">
          {count === 0
            ? "Crop fixo no clipe todo."
            : `${count} keyframe${count > 1 ? "s" : ""} · mover o crop grava neste instante`}
        </span>
      </div>
    </div>
  );
}

type FaceDetectorCtor = new (o?: { fastMode?: boolean }) => {
  detect: (src: CanvasImageSource) => Promise<{ boundingBox: DOMRectReadOnly }[]>;
};

/** Automações: presets, zoom nos picos de áudio e detecção da webcam. */
function MotionControls({
  videoRef,
  sourceUrl,
  srcW,
  srcH,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sourceUrl: string;
  srcW: number;
  srcH: number;
}) {
  const applyPreset = useEditor((s) => s.applyPreset);
  const autoZoomPeaks = useEditor((s) => s.autoZoomPeaks);
  const setCamRect = useEditor((s) => s.setCamRect);
  const [intensity, setIntensity] = useState(0.5);
  const [busy, setBusy] = useState<"" | "audio" | "cam">("");
  const [msg, setMsg] = useState("");
  const env = useRef<{ url: string; env: number[] } | null>(null);
  const HOP = 0.05;

  const zoomPeaks = async () => {
    setBusy("audio");
    setMsg("");
    try {
      if (env.current?.url !== sourceUrl) {
        const buf = await (await fetch(sourceUrl)).arrayBuffer();
        const ctx = new AudioContext();
        const audio = await ctx.decodeAudioData(buf);
        void ctx.close();
        const mono = new Float32Array(audio.length);
        for (let c = 0; c < audio.numberOfChannels; c++) {
          const ch = audio.getChannelData(c);
          for (let i = 0; i < ch.length; i++) mono[i]! += ch[i]! / audio.numberOfChannels;
        }
        env.current = { url: sourceUrl, env: rmsEnvelope(mono, audio.sampleRate, HOP) };
      }
      const peaks = detectPeaks(env.current.env, { hop: HOP, intensity, within: useEditor.getState().segments });
      autoZoomPeaks(peaks);
      setMsg(peaks.length ? `${peaks.length} pico${peaks.length > 1 ? "s" : ""} com zoom.` : "Nenhum pico encontrado; aumente a intensidade.");
    } catch {
      setMsg("Não foi possível analisar o áudio.");
    } finally {
      setBusy("");
    }
  };

  const detectCam = async () => {
    const FD = (window as unknown as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
    const v = videoRef.current;
    if (!FD || !v) {
      setMsg("Detecção de rosto indisponível neste navegador.");
      return;
    }
    setBusy("cam");
    setMsg("");
    const back = v.currentTime;
    try {
      const det = new FD({ fastMode: true });
      const canvas = document.createElement("canvas");
      canvas.width = srcW;
      canvas.height = srcH;
      const g = canvas.getContext("2d")!;
      const faces = [];
      const dur = v.duration || 0;
      for (let i = 1; i <= 8; i++) {
        v.currentTime = (dur * i) / 9;
        await new Promise((r) => v.addEventListener("seeked", r, { once: true }));
        g.drawImage(v, 0, 0, srcW, srcH);
        const found = await det.detect(canvas);
        // O streamer costuma ser o maior rosto do frame.
        const b = found.map((f) => f.boundingBox).sort((a, z) => z.width * z.height - a.width * a.height)[0];
        if (b) faces.push({ x: b.x / srcW, y: b.y / srcH, w: b.width / srcW, h: b.height / srcH });
      }
      const rect = camRectFromFaces(faces, srcW, srcH);
      if (rect) setCamRect(rect);
      setMsg(rect ? "Webcam enquadrada." : "Nenhum rosto encontrado.");
    } catch {
      setMsg("Falha ao detectar a webcam.");
    } finally {
      v.currentTime = back;
      setBusy("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted">Movimento automático</span>
      <div className="flex flex-wrap gap-2">
        {MOTION_PRESETS.map((p) => (
          <Button key={p.id} size="sm" variant="secondary" onClick={() => applyPreset(p.id)}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center text-[12px] text-muted">
        <Button size="sm" variant="secondary" disabled={!!busy} onClick={zoomPeaks}>
          {busy === "audio" ? "Analisando…" : "Zoom nos picos de áudio"}
        </Button>
        Intensidade
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={intensity}
          onChange={(e) => setIntensity(+e.target.value)}
        />
        <Button size="sm" variant="secondary" disabled={!!busy} onClick={detectCam}>
          {busy === "cam" ? "Detectando…" : "Detectar webcam"}
        </Button>
      </div>
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
    </div>
  );
}

function FocusLayoutPicker({ srcW, srcH }: { srcW: number; srcH: number }) {
  const panes = useEditor((s) => s.composition);
  const setComposition = useEditor((s) => s.setComposition);
  const addTrack = useEditor((s) => s.addTrack);
  const currentTime = useEditor((s) => s.currentTime);
  const count = panes?.length ?? 1;
  const current = count === 4 ? "grid_2x2" : count === 2
    ? (panes?.[0]?.destination.w === 0.5 ? "split_vertical" : "split_horizontal")
    : "full";
  const options = [
    ["full", "Tela cheia"],
    ["split_vertical", "2 colunas"],
    ["split_horizontal", "2 linhas"],
    ["grid_2x2", "Grade 4"],
  ] as const;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted">Composição de focos</span>
      <span className="text-[12px] text-muted">Escolha um formato e arraste cada foco no vídeo para enquadrar os apresentadores.</span>
      <div className="flex flex-wrap gap-2">
        {options.map(([preset, label]) => (
          <Button key={preset} size="sm" variant={current === preset ? "primary" : "secondary"} onClick={() => setComposition(preset, srcW, srcH)}>
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (panes?.length) setComposition("full", srcW, srcH);
            addTrack(currentTime);
          }}
        >
          Adicionar webcam
        </Button>
      </div>
    </div>
  );
}

function LayoutPicker({
  active,
  onActive,
}: {
  active: SlotKey;
  onActive: (k: SlotKey) => void;
}) {
  const layout = useFraming("layout");
  const activeTrack = useEditor((s) => s.activeTrack);
  const setActiveTrack = useEditor((s) => s.setActiveTrack);
  const addTrack = useEditor((s) => s.addTrack);
  const camPos = useFraming("camPos");
  const setCamPos = useEditor((s) => s.setCamPos);
  const onCam = activeTrack > 0;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted">Layout</span>
      <div className="flex gap-2">
        <Button size="sm" variant={!onCam ? "primary" : "secondary"} onClick={() => setActiveTrack(0)}>
          Tela cheia
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            addTrack(useEditor.getState().currentTime);
            onActive("cam");
          }}
        >
          Adicionar câmera
        </Button>
      </div>
      {onCam && layout === "cam_game" && (
        <div className="flex gap-2 items-center text-[13px] text-muted">
          Disposição:
          {(["top", "bottom"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={camPos === p ? "primary" : "ghost"}
              onClick={() => setCamPos(p)}
            >
              {p === "top" ? "Cam em cima" : "Cam embaixo"}
            </Button>
          ))}
        </div>
      )}
      {onCam && layout === "cam_game" && (
        <div className="flex gap-2 items-center text-[13px] text-muted">
          Editando:
          {(["game", "cam"] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={active === k ? "primary" : "ghost"}
              onClick={() => onActive(k)}
            >
              {k === "game" ? "Jogo" : "Cam"}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
