"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useEditor } from "@/lib/editor/store";
import {
  CAM_H,
  OUT_H,
  OUT_W,
  centeredCrop,
  cropToPixels,
  lockAspect,
  slotsFor,
  type EditorState,
  type Layout,
  type NRect,
} from "@/lib/export/layouts";
import type { ClipStatus, Json } from "@/lib/supabase/database.types";
import { ClipStatusBadge } from "./ClipStatusBadge";
import { EditorLoader, type LoaderStep } from "./EditorLoader";
import { ExportPanel } from "./ExportPanel";
import { LeaveGuard } from "./LeaveGuard";
import { nextClip } from "./actions";

type SlotKey = "game" | "cam";
type Ingest = {
  clipId: string;
  channel: string | null;
  status: ClipStatus;
  duration: number;
  /** Proxy same-origin do MP4 da Twitch (Range), usado no <video> e no export. */
  sourceUrl: string;
};

type Phase = "ingest" | "project";

const INGEST_ERRORS: Record<string, string> = {
  too_long: "O clipe tem mais de 90 s, limite do MVP.",
  unauthenticated: "Entre na sua conta para editar clipes.",
  clip_not_found: "Clipe não encontrado na Twitch.",
};

/** Proporção (w/h) do slot de destino de cada crop. */
function slotAspect(layout: Layout, key: SlotKey) {
  const s = slotsFor(layout).find((x) => x.key === key);
  return s ? { w: s.dw, h: s.dh } : { w: OUT_W, h: CAM_H };
}

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
};

export function ClipEditor({
  twitchId,
  userId,
  title,
}: {
  twitchId: string;
  userId: string;
  title: string;
}) {
  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("ingest");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const init = useEditor((s) => s.init);

  // Ingestão do MP4 + carga do projeto salvo.
  useEffect(() => {
    let alive = true;
    (async () => {
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
      setIngest(json);
    })().catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [twitchId, userId, init]);

  // Autosave com debounce de 1 s; primeira edição marca o clipe como em edição.
  useEffect(() => {
    if (!ingest) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let marked = ingest.status !== "novo";
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.trim === prev.trim && s.layout === prev.layout && s.camPos === prev.camPos && s.crops === prev.crops) return;
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
      saving={saving}
    />
  );
}

function EditorBody({
  ingest,
  userId,
  title,
  saving,
}: {
  ingest: Ingest;
  userId: string;
  title: string;
  saving: "idle" | "saving" | "saved";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState<SlotKey>("game");
  const [loop, setLoop] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [src, setSrc] = useState({ w: 1920, h: 1080 });
  const layout = useEditor((s) => s.layout);
  const router = useRouter();
  const [nextPending, startNext] = useTransition();
  const [noNext, setNoNext] = useState(false);
  const [exported, setExported] = useState(ingest.status === "exportado");

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
  }, [volume, muted, ingest]);

  const activeKey: SlotKey = layout === "full" ? "game" : active;

  // Mantém currentTime/playing no store e respeita o trim (loop opcional).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let raf = 0;
    const tick = () => {
      const { trim, setTime } = useEditor.getState();
      if (!v.seeking && v.currentTime >= trim.end) {
        if (loop) v.currentTime = trim.start;
        else v.pause();
      }
      setTime(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onPlay = () => useEditor.getState().setPlaying(true);
    const onPause = () => useEditor.getState().setPlaying(false);
    const onMeta = () => {
      if (v.videoWidth) setSrc({ w: v.videoWidth, h: v.videoHeight });
      v.currentTime = useEditor.getState().trim.start;
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
    const { trim } = useEditor.getState();
    if (v.paused) {
      if (v.currentTime < trim.start || v.currentTime >= trim.end) v.currentTime = trim.start;
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
      const t = videoRef.current?.currentTime ?? st.currentTime;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "i":
        case "I":
          st.setTrim(t, st.trim.end);
          break;
        case "o":
        case "O":
          st.setTrim(st.trim.start, t);
          break;
        case "l":
        case "L":
          setLoop((x) => !x);
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
  }, [togglePlay, seek]);

  function goNext() {
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
        <ClipStatusBadge clipId={ingest.clipId} initial={ingest.status} />
        <span className="text-[13px] text-muted">
          {saving === "saving" ? "Salvando…" : saving === "saved" ? "Alterações salvas" : ""}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={goNext} disabled={nextPending}>
            {nextPending ? "Buscando…" : "Próximo clip →"}
          </Button>
        </div>
      </div>
      {noNext && (
        <p className="text-[13px] text-muted">
          Nenhum outro clipe novo na sua biblioteca.
        </p>
      )}

      <div className="grid grid-cols-[1fr_300px] gap-5 items-start max-[960px]:grid-cols-1">
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
            />
            <CropOverlay activeKey={activeKey} srcW={src.w} srcH={src.h} />
          </div>
          <TrimTimeline duration={ingest.duration} onSeek={seek} />
          <div className="flex items-center gap-2 flex-wrap text-[13px] text-muted">
            <Button variant="secondary" size="sm" onClick={togglePlay}>
              <PlayLabel />
            </Button>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              Loop (L)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Ativar som" : "Silenciar"}
                className="w-6 text-center hover:text-text"
              >
                {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
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
            <span className="ml-auto">
              Espaço play · I/O início/fim · ←/→ quadro (Shift: 1 s) · duplo clique no crop centraliza
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <VerticalPreview videoRef={videoRef} srcW={src.w} srcH={src.h} />
          <LayoutPicker active={activeKey} onActive={setActive} />
          <ExportPanel
            clipId={ingest.clipId}
            userId={userId}
            sourceUrl={ingest.sourceUrl}
            fileName={`${(ingest.channel ?? "clip").replace(/\W+/g, "_")}-${title.slice(0, 40).replace(/\W+/g, "_")}.mp4`}
            onExported={() => setExported(true)}
          />
          <LeaveGuard active={!exported} />
        </div>
      </div>
    </div>
  );
}

function PlayLabel() {
  const playing = useEditor((s) => s.playing);
  return playing ? (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-label="Pausar">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-label="Reproduzir">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}

/** Retângulo de crop arrastável sobre o player (mover + redimensionar travado). */
function CropOverlay({
  activeKey,
  srcW,
  srcH,
}: {
  activeKey: SlotKey;
  srcW: number;
  srcH: number;
}) {
  const layout = useEditor((s) => s.layout);
  const crops = useEditor((s) => s.crops);
  const setCrop = useEditor((s) => s.setCrop);
  const boxRef = useRef<HTMLDivElement>(null);

  function drag(e: React.PointerEvent, key: SlotKey, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const start = { x: e.clientX, y: e.clientY, r: useEditor.getState().crops[key] };
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
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  srcW: number;
  srcH: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const PW = 270;
  const PH = (PW * OUT_H) / OUT_W;

  useEffect(() => {
    const c = canvasRef.current;
    const g = c?.getContext("2d");
    if (!c || !g) return;
    const k = PW / OUT_W;
    let raf = 0;
    const draw = () => {
      const v = videoRef.current;
      const { layout, camPos, crops } = useEditor.getState();
      g.fillStyle = "#000";
      g.fillRect(0, 0, PW, PH);
      if (v && v.readyState >= 2) {
        for (const s of slotsFor(layout, camPos)) {
          const p = cropToPixels(crops[s.key], v.videoWidth || srcW, v.videoHeight || srcH);
          g.drawImage(v, p.sx, p.sy, p.sw, p.sh, s.dx * k, s.dy * k, s.dw * k, s.dh * k);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, srcW, srcH, PH]);

  return (
    <canvas
      ref={canvasRef}
      width={PW}
      height={PH}
      className="rounded-md border border-border bg-black self-center"
      style={{ width: PW, height: PH }}
    />
  );
}

/** Barra de trim com alças de início/fim e playhead; clique busca. */
function TrimTimeline({
  duration,
  onSeek,
}: {
  duration: number;
  onSeek: (t: number) => void;
}) {
  const trim = useEditor((s) => s.trim);
  const currentTime = useEditor((s) => s.currentTime);
  const setTrim = useEditor((s) => s.setTrim);
  const barRef = useRef<HTMLDivElement>(null);
  const pct = (t: number) => `${(duration ? t / duration : 0) * 100}%`;

  const timeAt = (clientX: number) => {
    const b = barRef.current?.getBoundingClientRect();
    if (!b) return 0;
    return Math.max(0, Math.min(1, (clientX - b.left) / b.width)) * duration;
  };

  function dragHandle(e: React.PointerEvent, which: "start" | "end") {
    e.preventDefault();
    e.stopPropagation();
    const onMove = (ev: PointerEvent) => {
      const t = timeAt(ev.clientX);
      const cur = useEditor.getState().trim;
      if (which === "start") setTrim(t, cur.end);
      else setTrim(cur.start, t);
      onSeek(t);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={barRef}
        className="relative h-10 rounded-sm bg-border/60 cursor-pointer"
        onPointerDown={(e) => onSeek(timeAt(e.clientX))}
      >
        <div
          className="absolute top-0 bottom-0 bg-accent/30 border-y-2 border-accent"
          style={{ left: pct(trim.start), width: pct(trim.end - trim.start) }}
        />
        {(["start", "end"] as const).map((w) => (
          <div
            key={w}
            className="absolute top-0 bottom-0 w-2.5 -ml-[5px] bg-accent rounded-sm cursor-ew-resize"
            style={{ left: pct(trim[w]) }}
            onPointerDown={(e) => dragHandle(e, w)}
          />
        ))}
        <div
          className="absolute -top-1 -bottom-1 w-0.5 bg-fg pointer-events-none"
          style={{ left: pct(currentTime) }}
        />
      </div>
      <div className="flex justify-between text-[12px] text-muted tabular-nums">
        <span>Início {fmt(trim.start)}</span>
        <span>
          {fmt(currentTime)} · duração do corte {(trim.end - trim.start).toFixed(1)} s
        </span>
        <span>Fim {fmt(trim.end)}</span>
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
  const layout = useEditor((s) => s.layout);
  const setLayout = useEditor((s) => s.setLayout);
  const camPos = useEditor((s) => s.camPos);
  const setCamPos = useEditor((s) => s.setCamPos);
  const opts: Array<{ value: Layout; label: string }> = [
    { value: "full", label: "Tela cheia" },
    { value: "cam_game", label: "Cam + jogo" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted">Layout</span>
      <div className="flex gap-2">
        {opts.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={layout === o.value ? "primary" : "secondary"}
            onClick={() => setLayout(o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
      {layout === "cam_game" && (
        <div className="flex gap-2 items-center text-[13px] text-muted">
          Cam:
          {(["top", "bottom"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={camPos === p ? "primary" : "ghost"}
              onClick={() => setCamPos(p)}
            >
              {p === "top" ? "Em cima" : "Embaixo"}
            </Button>
          ))}
        </div>
      )}
      {layout === "cam_game" && (
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
