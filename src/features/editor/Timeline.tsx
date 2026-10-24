"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/lib/editor/store";
import { Icon, type IconName } from "@/components/ui/Icon";
import { outputSegments, segmentIndexAt, segmentsTotal } from "@/lib/export/layouts";

const MAX_ZOOM = 20;
const SNAP_PX = 8;
const PEAK_BINS = 2000;
const THUMBS = 12;

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/** Picos de amplitude (0–1) do áudio da fonte, via decodeAudioData. */
function useWaveform(url: string) {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    (async () => {
      const buf = await (await fetch(url, { signal: ctrl.signal })).arrayBuffer();
      const ctx = new AudioContext();
      try {
        const audio = await ctx.decodeAudioData(buf);
        const data = audio.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / PEAK_BINS));
        const out = new Float32Array(PEAK_BINS);
        let max = 0;
        for (let i = 0; i < PEAK_BINS; i++) {
          let p = 0;
          const end = Math.min(data.length, (i + 1) * step);
          for (let j = i * step; j < end; j++) p = Math.max(p, Math.abs(data[j]!));
          out[i] = p;
          max = Math.max(max, p);
        }
        if (max > 0) for (let i = 0; i < PEAK_BINS; i++) out[i] = out[i]! / max;
        if (alive) setPeaks(out);
      } finally {
        ctx.close();
      }
    })().catch(() => {});
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [url]);
  return peaks;
}

/** Thumbnails espaçados capturados de um <video> fora da tela. */
function useFilmstrip(url: string, duration: number) {
  const [thumbs, setThumbs] = useState<string[]>([]);
  useEffect(() => {
    if (!duration) return;
    let alive = true;
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.preload = "auto";
    v.src = url;
    const c = document.createElement("canvas");
    (async () => {
      await new Promise<void>((res, rej) => {
        v.onloadeddata = () => res();
        v.onerror = () => rej(new Error("thumb"));
      });
      c.height = 72;
      c.width = Math.round((72 * v.videoWidth) / v.videoHeight) || 128;
      const g = c.getContext("2d")!;
      const out: string[] = [];
      for (let i = 0; i < THUMBS && alive; i++) {
        v.currentTime = ((i + 0.5) / THUMBS) * duration;
        await new Promise<void>((res) => (v.onseeked = () => res()));
        g.drawImage(v, 0, 0, c.width, c.height);
        out.push(c.toDataURL("image/jpeg", 0.6));
        if (alive) setThumbs([...out]);
      }
    })().catch(() => {});
    return () => {
      alive = false;
      v.removeAttribute("src");
      v.load();
    };
  }, [url, duration]);
  return thumbs;
}

/** "video" = faixa principal; número = faixa extra (índice `ti`, 1-based). */
export type Track = "video" | "audio" | number;
export type Selection = { track: Track; i: number } | null;

const RATES = [0.5, 1, 1.5, 2];

function ToolBtn({
  icon,
  label,
  onClick,
  disabled,
  active,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-sm transition-colors disabled:opacity-35 disabled:pointer-events-none ${
        active ? "bg-accent/20 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      <Icon name={icon} width={17} height={17} />
    </button>
  );
}

const Sep = () => <span className="w-px h-5 bg-border mx-1" />;

/**
 * Timeline multi-faixa: régua, faixa de vídeo (filmstrip) e faixa de áudio
 * (waveform). Segmentos selecionáveis com bordas arrastáveis (snapping), zoom
 * com Ctrl+scroll e toolbar de edição/reprodução.
 */
export function Timeline({
  duration,
  sourceUrl,
  selected,
  onSelect,
  onSeek,
  playing,
  onTogglePlay,
  loop,
  onToggleLoop,
  rate,
  onRate,
}: {
  duration: number;
  sourceUrl: string;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onSeek: (t: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  loop: boolean;
  onToggleLoop: () => void;
  rate: number;
  onRate: (r: number) => void;
}) {
  const segments = useEditor((s) => s.segments);
  const audio = useEditor((s) => s.audio);
  const tracks = useEditor((s) => s.tracks) ?? [];
  const activeTrack = useEditor((s) => s.activeTrack);
  const mainKeyframes = useEditor((s) => s.keyframes);
  const currentTime = useEditor((s) => s.currentTime);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaks = useWaveform(sourceUrl);
  const thumbs = useFilmstrip(sourceUrl, duration);
  const pct = (t: number) => `${(duration ? t / duration : 0) * 100}%`;
  const detached = audio != null;
  const audioSegs = audio ?? segments;
  const videoH = expanded ? 96 : 56;
  const audioH = expanded ? 80 : 44;

  // Canvas com tamanho fixo no JSX: carregar os picos não muda o layout.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !peaks) return;
    drawPeaks(c, peaks);
  }, [peaks]);

  // Ctrl+scroll dá zoom ancorado no cursor (listener não-passivo para preventDefault).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frac = (el.scrollLeft + x) / el.scrollWidth;
      setZoom((z) => {
        const nz = Math.min(MAX_ZOOM, Math.max(1, z * (e.deltaY < 0 ? 1.25 : 0.8)));
        requestAnimationFrame(() => {
          el.scrollLeft = frac * el.scrollWidth - x;
        });
        return nz;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /** Zoom pelos botões, ancorado no playhead. */
  function zoomBy(f: number) {
    const el = scrollRef.current;
    setZoom((z) => {
      const nz = Math.min(MAX_ZOOM, Math.max(1, z * f));
      if (el && duration) {
        requestAnimationFrame(() => {
          el.scrollLeft = (useEditor.getState().currentTime / duration) * el.scrollWidth - el.clientWidth / 2;
        });
      }
      return nz;
    });
  }

  const timeAt = (clientX: number) => {
    const b = barRef.current?.getBoundingClientRect();
    if (!b) return 0;
    return Math.max(0, Math.min(1, (clientX - b.left) / b.width)) * duration;
  };

  /** Aproxima t do ponto de interesse mais próximo dentro de SNAP_PX. */
  function snap(t: number, track: Track, skip: number) {
    const b = barRef.current?.getBoundingClientRect();
    if (!b || !duration) return t;
    const tol = (SNAP_PX / b.width) * duration;
    const st = useEditor.getState();
    const pts = [0, duration, st.currentTime];
    const lists: [Track, { start: number; end: number }[]][] = [
      ["video", st.segments],
      ["audio", st.audio ?? []],
      ...(st.tracks ?? []).map((tr, k) => [k + 1, tr.segments] as [Track, typeof tr.segments]),
    ];
    for (const [key, list] of lists) {
      list.forEach((s, j) => {
        if (key !== track || j !== skip) pts.push(s.start, s.end);
      });
    }
    let best = t;
    let dist = tol;
    for (const p of pts) {
      if (Math.abs(p - t) < dist) {
        dist = Math.abs(p - t);
        best = p;
      }
    }
    return best;
  }

  function dragEdge(e: React.PointerEvent, track: Track, i: number, which: "start" | "end") {
    e.preventDefault();
    e.stopPropagation();
    onSelect({ track, i });
    const onMove = (ev: PointerEvent) => {
      const t = snap(timeAt(ev.clientX), track, i);
      const st = useEditor.getState();
      if (typeof track === "number") st.setTrackSegmentEdge(track, i, which, t);
      else if (track === "audio") st.setAudioSegmentEdge(i, which, t);
      else st.setSegmentEdge(i, which, t);
      onSeek(t);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Mantém o playhead visível quando há zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || zoom === 1 || !duration) return;
    const x = (currentTime / duration) * el.scrollWidth;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth) {
      el.scrollLeft = x - el.clientWidth / 4;
    }
  }, [currentTime, zoom, duration]);

  /** Faixa que recebe dividir/remover: a selecionada, a faixa extra ativa, ou vídeo. */
  const editTrack: Track =
    selected?.track === "audio" && detached
      ? "audio"
      : typeof selected?.track === "number"
        ? selected.track
        : selected?.track === "video" || activeTrack === 0
          ? "video"
          : activeTrack;

  function doSplit() {
    const st = useEditor.getState();
    if (typeof editTrack === "number") st.splitTrack(editTrack, st.currentTime);
    else if (editTrack === "audio") st.splitAudio(st.currentTime);
    else st.split(st.currentTime);
  }

  function doRemove() {
    const st = useEditor.getState();
    const list =
      typeof editTrack === "number"
        ? (st.tracks?.[editTrack - 1]?.segments ?? [])
        : editTrack === "audio"
          ? (st.audio ?? [])
          : st.segments;
    const i = selected && selected.track === editTrack ? selected.i : segmentIndexAt(list, st.currentTime);
    if (i < 0) return;
    if (typeof editTrack === "number") st.removeTrackSegment(editTrack, i);
    else if (editTrack === "audio") st.removeAudioAt(i);
    else st.removeAt(i);
    onSelect(null);
  }

  function selectTrack(track: Track, i: number) {
    onSelect({ track, i });
    if (track !== "audio") useEditor.getState().setActiveTrack(typeof track === "number" ? track : 0);
  }

  function seekEdge(dir: -1 | 1) {
    const t = useEditor.getState().currentTime;
    const pts = [0, duration, ...segments.flatMap((s) => [s.start, s.end])].sort((a, b) => a - b);
    const target = dir < 0 ? [...pts].reverse().find((p) => p < t - 0.05) : pts.find((p) => p > t + 0.05);
    onSeek(target ?? (dir < 0 ? 0 : duration));
  }

  // Marcas da régua: passo que dá ~10 marcas visíveis por tela.
  const visible = duration / zoom;
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60].find((s) => visible / s <= 10) ?? 60;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6 && duration; t += step) ticks.push(t);

  const total = segmentsTotal(outputSegments(useEditor.getState()));
  const removeDisabled =
    typeof editTrack === "number"
      ? !tracks[editTrack - 1]?.segments.length
      : editTrack === "video"
        ? segments.length <= 1
        : !(audio && audio.length);
  const trackH = expanded ? 64 : 40;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-2">
      <div className="flex items-center gap-0.5 flex-wrap">
        <ToolBtn
          icon="scissors"
          label={`Dividir ${editTrack === "audio" ? "áudio" : typeof editTrack === "number" ? `faixa V${editTrack + 1}` : "vídeo"} (S)`}
          onClick={doSplit}
        />
        <ToolBtn icon="trash" label="Remover trecho (Del)" onClick={doRemove} disabled={removeDisabled} />
        <Sep />
        <ToolBtn icon="undo" label="Desfazer (Ctrl+Z)" onClick={() => useEditor.getState().undo()} disabled={!canUndo} />
        <ToolBtn icon="redo" label="Refazer (Ctrl+Y)" onClick={() => useEditor.getState().redo()} disabled={!canRedo} />
        <Sep />
        <ToolBtn
          icon={detached ? "link" : "unlink"}
          label={detached ? "Vincular áudio ao vídeo" : "Separar áudio do vídeo"}
          onClick={() => {
            const st = useEditor.getState();
            if (detached) st.linkAudio();
            else st.detachAudio();
            onSelect(null);
          }}
          active={detached}
        />
        <ToolBtn
          icon="plus"
          label="Adicionar câmera"
          onClick={() => {
            const st = useEditor.getState();
            st.addTrack(st.currentTime);
            onSelect({ track: (st.tracks?.length ?? 0) + 1, i: 0 });
          }}
        />

        <div className="flex-1 flex items-center justify-center gap-0.5 min-w-[240px]">
          <ToolBtn icon="skip-back" label="Corte anterior" onClick={() => seekEdge(-1)} />
          <ToolBtn icon={playing ? "pause" : "play"} label={playing ? "Pausar (Espaço)" : "Reproduzir (Espaço)"} onClick={onTogglePlay} />
          <ToolBtn icon="skip-forward" label="Próximo corte" onClick={() => seekEdge(1)} />
          <ToolBtn icon="repeat" label="Repetir" onClick={onToggleLoop} active={loop} />
          <span className="ml-2 text-[12px] tabular-nums text-muted">
            <span className="text-fg">{fmt(currentTime)}</span> / {fmt(duration)}
          </span>
          <select
            value={rate}
            onChange={(e) => onRate(Number(e.target.value))}
            title="Velocidade"
            aria-label="Velocidade de reprodução"
            className="ml-2 h-7 rounded-sm bg-surface-2 text-[12px] px-1 text-fg border border-border"
          >
            {RATES.map((r) => (
              <option key={r} value={r}>
                {r.toLocaleString("pt-BR")}×
              </option>
            ))}
          </select>
        </div>

        <ToolBtn icon="zoom-out" label="Diminuir zoom" onClick={() => zoomBy(0.8)} disabled={zoom <= 1} />
        <input
          type="range"
          min={0}
          max={Math.log(MAX_ZOOM)}
          step={0.01}
          value={Math.log(zoom)}
          onChange={(e) => setZoom(Math.exp(Number(e.target.value)))}
          aria-label="Zoom da timeline"
          className="w-20 accent-twitch"
        />
        <ToolBtn icon="zoom-in" label="Aumentar zoom" onClick={() => zoomBy(1.25)} disabled={zoom >= MAX_ZOOM} />
        <ToolBtn icon="fit" label="Ajustar à tela" onClick={() => setZoom(1)} disabled={zoom === 1} />
        <Sep />
        <ToolBtn
          icon={expanded ? "collapse" : "expand"}
          label={expanded ? "Recolher timeline" : "Expandir timeline"}
          onClick={() => setExpanded((x) => !x)}
        />
      </div>

      <div className="flex">
        {/* Cabeçalhos das faixas */}
        <div className="w-8 shrink-0 flex flex-col text-muted">
          <div className="h-5" />
          <button
            type="button"
            className={`flex flex-col items-center justify-center rounded-sm ${activeTrack === 0 ? "text-accent bg-accent/10" : "hover:text-fg"}`}
            style={{ height: videoH }}
            title="Vídeo principal (clique para editar o enquadramento)"
            onClick={() => useEditor.getState().setActiveTrack(0)}
          >
            <Icon name="film" width={15} height={15} />
            <span className="text-[9px]">V1</span>
          </button>
          {tracks.map((tr, k) => (
            <div key={tr.id} className="flex flex-col">
              <div className="h-1" />
              <div
                className={`group relative flex flex-col items-center justify-center rounded-sm cursor-pointer ${activeTrack === k + 1 ? "text-accent bg-accent/10" : "hover:text-fg"}`}
                style={{ height: trackH }}
                title={`Faixa V${k + 2} (clique para editar o enquadramento)`}
                onClick={() => useEditor.getState().setActiveTrack(k + 1)}
              >
                <span className="text-[9px]">C{k + 1}</span>
                <button
                  type="button"
                  aria-label={`Remover faixa V${k + 2}`}
                  title="Remover faixa"
                  className="text-muted hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    useEditor.getState().removeTrack(k + 1);
                    onSelect(null);
                  }}
                >
                  <Icon name="trash" width={12} height={12} />
                </button>
              </div>
            </div>
          ))}
          <div className="h-1" />
          <div className="flex items-center justify-center" style={{ height: audioH }} title="Áudio">
            <Icon name="music" width={15} height={15} />
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-w-0 overflow-x-auto rounded-sm">
          <div
            ref={barRef}
            className="relative cursor-pointer select-none"
            style={{ width: `${zoom * 100}%` }}
            onPointerDown={(e) => {
              onSelect(null);
              onSeek(timeAt(e.clientX));
            }}
          >
            {/* Régua */}
            <div className="relative h-5 text-[10px] text-muted tabular-nums">
              {ticks.map((t) => (
                <div key={t} className="absolute top-0 bottom-0 border-l border-border pl-1" style={{ left: pct(t) }}>
                  {fmt(t).replace(/\.0$/, "")}
                </div>
              ))}
            </div>

            {/* Faixa de vídeo */}
            <div className="relative bg-border/40 rounded-sm overflow-hidden transition-[height]" style={{ height: videoH }}>
              <div className="absolute inset-0 flex opacity-35 pointer-events-none">
                {thumbs.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={src} alt="" className="h-full flex-1 min-w-0 object-cover" />
                ))}
              </div>
              {segments.map((s, i) => (
                <SegmentBlock
                  key={i}
                  left={pct(s.start)}
                  width={pct(s.end - s.start)}
                  selected={selected?.track === "video" && selected.i === i}
                  onDown={(e) => {
                    e.stopPropagation();
                    selectTrack("video", i);
                    onSeek(timeAt(e.clientX));
                  }}
                  onEdge={(e, w) => dragEdge(e, "video", i, w)}
                >
                  <div className="absolute inset-0 flex overflow-hidden pointer-events-none">
                    {thumbs.length > 0 && (
                      <div
                        className="absolute inset-y-0 flex"
                        style={{
                          width: `${(duration / (s.end - s.start)) * 100}%`,
                          left: `${(-s.start / (s.end - s.start)) * 100}%`,
                        }}
                      >
                        {thumbs.map((src, k) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={k} src={src} alt="" className="h-full flex-1 min-w-0 object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                </SegmentBlock>
              ))}
              <KeyframeMarks keyframes={mainKeyframes} pct={pct} onSeek={onSeek} />
            </div>

            {/* Faixas de vídeo extras: sobrepõem o enquadramento nos seus trechos */}
            {tracks.map((tr, k) => (
              <div key={tr.id}>
                <div className="h-1" />
                <div
                  className={`relative bg-border/40 rounded-sm overflow-hidden transition-[height] ${activeTrack === k + 1 ? "ring-1 ring-accent/60" : ""}`}
                  style={{ height: trackH }}
                >
                  {tr.segments.map((s, i) => (
                    <SegmentBlock
                      key={i}
                      left={pct(s.start)}
                      width={pct(s.end - s.start)}
                      tone="overlay"
                      selected={selected?.track === k + 1 && selected.i === i}
                      onDown={(e) => {
                        e.stopPropagation();
                        selectTrack(k + 1, i);
                        onSeek(timeAt(e.clientX));
                      }}
                      onEdge={(e, w) => dragEdge(e, k + 1, i, w)}
                    >
                      <span className="absolute inset-0 flex items-center px-3 text-[10px] text-fg/80 pointer-events-none truncate">
                        {`Câmera ${tr.camPos === "top" ? "em cima" : "embaixo"}`}
                      </span>
                    </SegmentBlock>
                  ))}
                  <KeyframeMarks keyframes={tr.keyframes} pct={pct} onSeek={onSeek} />
                </div>
              </div>
            ))}

            <div className="h-1" />

            {/* Faixa de áudio */}
            <div className="relative bg-border/40 rounded-sm overflow-hidden transition-[height]" style={{ height: audioH }}>
              <canvas
                ref={canvasRef}
                width={PEAK_BINS}
                height={64}
                className="absolute inset-0 h-full w-full opacity-30 pointer-events-none"
              />
              {audioSegs.map((s, i) => (
                <SegmentBlock
                  key={i}
                  left={pct(s.start)}
                  width={pct(s.end - s.start)}
                  tone="audio"
                  selected={detached && selected?.track === "audio" && selected.i === i}
                  onDown={(e) => {
                    e.stopPropagation();
                    onSelect(detached ? { track: "audio", i } : { track: "video", i });
                    onSeek(timeAt(e.clientX));
                  }}
                  onEdge={detached ? (e, w) => dragEdge(e, "audio", i, w) : undefined}
                >
                  <div
                    className="absolute inset-y-0 pointer-events-none"
                    style={{
                      width: `${(duration / (s.end - s.start)) * 100}%`,
                      left: `${(-s.start / (s.end - s.start)) * 100}%`,
                    }}
                  >
                    <WaveMirror peaks={peaks} />
                  </div>
                </SegmentBlock>
              ))}
              {detached && !audioSegs.length && (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted pointer-events-none">
                  Sem áudio
                </div>
              )}
            </div>

            <div
              className="absolute top-0 bottom-0 w-0.5 bg-fg pointer-events-none"
              style={{ left: pct(currentTime) }}
            >
              <div className="absolute -top-0 -left-[4px] w-2.5 h-2.5 rotate-45 bg-fg" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between text-[12px] text-muted tabular-nums">
        <span>
          {segments.length} {segments.length === 1 ? "trecho" : "trechos"}
          {detached && ` · áudio separado (${audioSegs.length})`}
          {zoom > 1 && ` · zoom ${zoom.toFixed(1)}×`}
        </span>
        <span>duração final {total.toFixed(1)} s</span>
        <span>Ctrl+scroll: zoom</span>
      </div>
    </div>
  );
}

function SegmentBlock({
  left,
  width,
  selected,
  tone = "video",
  onDown,
  onEdge,
  children,
}: {
  left: string;
  width: string;
  selected: boolean;
  tone?: "video" | "audio" | "overlay";
  onDown: (e: React.PointerEvent) => void;
  onEdge?: (e: React.PointerEvent, which: "start" | "end") => void;
  children?: React.ReactNode;
}) {
  const color = tone === "audio" ? "bg-emerald-500" : tone === "overlay" ? "bg-sky-500" : "bg-accent";
  const border = tone === "audio" ? "border-emerald-500/70" : tone === "overlay" ? "border-sky-500/80" : "border-accent/80";
  const bg = tone === "audio" ? "bg-emerald-500/15" : tone === "overlay" ? "bg-sky-500/25" : "bg-accent/15";
  return (
    <div
      className={`absolute top-0 bottom-0 rounded-sm overflow-hidden border-2 ${selected ? "border-fg" : border} ${bg}`}
      style={{ left, width }}
      onPointerDown={onDown}
    >
      {children}
      {onEdge &&
        (["start", "end"] as const).map((w) => (
          <div
            key={w}
            className={`absolute top-0 bottom-0 w-2 ${color} cursor-ew-resize ${w === "start" ? "left-0" : "right-0"}`}
            onPointerDown={(e) => onEdge(e, w)}
          />
        ))}
    </div>
  );
}

function drawPeaks(c: HTMLCanvasElement, peaks: Float32Array) {
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(255,255,255,0.6)";
  for (let i = 0; i < peaks.length; i++) {
    const h = Math.max(1, peaks[i]! * c.height);
    g.fillRect(i, (c.height - h) / 2, 1, h);
  }
}

/** Waveform completa recortada pelo bloco pai. */
function WaveMirror({ peaks }: { peaks: Float32Array | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && peaks) drawPeaks(ref.current, peaks);
  }, [peaks]);
  return <canvas ref={ref} width={PEAK_BINS} height={64} className="h-full w-full" />;
}

/** Losangos dos keyframes de crop; clicar leva o playhead até eles. */
function KeyframeMarks({
  keyframes,
  pct,
  onSeek,
}: {
  keyframes: { t: number }[] | undefined;
  pct: (t: number) => string;
  onSeek: (t: number) => void;
}) {
  if (!keyframes?.length) return null;
  return (
    <>
      {keyframes.map((k) => (
        <button
          key={k.t}
          type="button"
          title={`Keyframe em ${k.t.toFixed(2)} s`}
          className="absolute top-0.5 z-10 size-2.5 -translate-x-1/2 rotate-45 bg-accent border border-bg hover:scale-125"
          style={{ left: pct(k.t) }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSeek(k.t);
          }}
        />
      ))}
    </>
  );
}
