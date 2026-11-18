"use client";

import { create } from "zustand";
import {
  MIN_SEGMENT,
  clampRect,
  cropsAt,
  defaultState,
  fitCrops,
  fitKeyframes,
  keyframeIndexAt,
  removeKeyframeAt,
  upsertKeyframe,
  normalizeAudio,
  normalizeSegments,
  removeSegment,
  splitAt,
  type CamPos,
  type EditorState,
  type Framing,
  type Layout,
  type NRect,
  type CaptionPosition,
  type Trim,
  type VideoTrack,
  panesForPreset,
  type FocusPane,
  type FocusPreset,
  type ImageOverlay,
  type TextOverlay,
  type CompositionSegment,
  type PaneSource,
} from "@/lib/export/layouts";
import { MOTION_PRESETS, applyMotionPreset, peakKeyframes, type MotionPreset } from "@/lib/editor/motion";

/** Estado salvo: aceita o formato antigo (trim único) para migração. */
type SavedState = Partial<EditorState> & { trim?: Trim };

const HISTORY_LIMIT = 100;
/** Edições dentro desta janela viram uma única entrada (ex.: arrastes). */
const HISTORY_GROUP_MS = 500;

interface EditorStore extends EditorState {
  duration: number;
  currentTime: number;
  playing: boolean;
  /** Faixa cujo enquadramento é editado: 0 = principal, i = tracks[i-1]. */
  activeTrack: number;
  past: EditorState[];
  future: EditorState[];
  init: (duration: number, saved?: SavedState | null) => void;
  setSegments: (segments: Trim[]) => void;
  setSegmentEdge: (i: number, which: "start" | "end", t: number) => void;
  split: (t: number) => void;
  removeAt: (i: number) => void;
  /** Separa o áudio do vídeo (passa a ter trechos próprios). */
  detachAudio: () => void;
  /** Volta a vincular o áudio ao vídeo. */
  linkAudio: () => void;
  splitAudio: (t: number) => void;
  removeAudioAt: (i: number) => void;
  setAudioSegmentEdge: (i: number, which: "start" | "end", t: number) => void;
  /** Cria uma faixa de cam com um trecho a partir de `t`. */
  addTrack: (t: number) => void;
  removeTrack: (ti: number) => void;
  setActiveTrack: (ti: number) => void;
  splitTrack: (ti: number, t: number) => void;
  removeTrackSegment: (ti: number, i: number) => void;
  setTrackSegmentEdge: (ti: number, i: number, which: "start" | "end", t: number) => void;
  /** Enquadramento da faixa ativa. */
  activeFraming: () => Framing;
  setLayout: (layout: Layout) => void;
  setCamPos: (camPos: CamPos) => void;
  /** Com keyframes, grava o crop num keyframe em `currentTime`. */
  setCrop: (key: "game" | "cam", rect: NRect) => void;
  /** Fixa os crops atuais num keyframe em `currentTime`. */
  addKeyframe: () => void;
  /** Remove o keyframe em `currentTime` (se houver). */
  removeKeyframe: () => void;
  /** Apaga todos os keyframes da faixa ativa, fixando o crop visível agora. */
  clearKeyframes: () => void;
  /** Aplica um preset de movimento a partir de `currentTime`. */
  applyPreset: (preset: MotionPreset) => void;
  /** Punch-in automático em cada pico de áudio (instantes em s). */
  autoZoomPeaks: (peaks: number[], strength?: number) => void;
  /** Enquadra a webcam detectada (vale para todos os keyframes). */
  setCamRect: (rect: NRect) => void;
  /** Volta a edição ao estado inicial do clipe (desfazível). */
  resetEdit: () => void;
  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  undo: () => void;
  redo: () => void;
  snapshot: () => EditorState;
  composition?: FocusPane[];
  compositionSegments?: CompositionSegment[];
  /** Índice do segmento de layout selecionado na timeline (-1 = nenhum). */
  selectedLayout: number;
  activePaneId: string;
  setComposition: (preset: FocusPreset, srcW?: number, srcH?: number) => void;
  setActivePane: (id: string) => void;
  setPaneCrop: (id: string, rect: NRect) => void;
  setPaneDestination: (id: string, rect: NRect) => void;
  /** Define a fonte de um quadro: recorte do vídeo (undefined/clip), imagem ou vídeo. */
  setPaneSource: (id: string, source: PaneSource | undefined) => void;
  /** Cria um segmento de layout no tempo atual (Fase 1B). */
  addCompositionLayout: (preset: FocusPreset, srcW?: number, srcH?: number) => void;
  removeCompositionLayout: (index: number) => void;
  setCompositionLayoutEdge: (index: number, which: "start" | "end", value: number) => void;
  selectLayout: (index: number) => void;
  setCaptionPosition: (position: CaptionPosition) => void;
  addImageOverlay: (src: string, width: number, height: number) => void;
  updateImageOverlay: (id: string, patch: Partial<Omit<ImageOverlay, "id" | "src">>) => void;
  removeImageOverlay: (id: string) => void;
  setImageOverlayEdge: (id: string, which: "start" | "end", value: number) => void;
  addTextOverlay: () => void;
  updateTextOverlay: (id: string, patch: Partial<Omit<TextOverlay, "id">>) => void;
  removeTextOverlay: (id: string) => void;
  setTextOverlayEdge: (id: string, which: "start" | "end", value: number) => void;
}

let lastCommit = 0;
let trackSeq = 0;
let overlaySeq = 0;

/** Duração padrão do trecho de uma faixa nova. */
const NEW_TRACK_SECONDS = 3;

export const useEditor = create<EditorStore>((set, get) => {
  /** Aplica uma edição registrando o estado anterior no histórico. */
  function commit(patch: Partial<EditorState>) {
    const now = Date.now();
    const grouped = now - lastCommit < HISTORY_GROUP_MS;
    lastCommit = now;
    set((s) => ({
      ...patch,
      activeTrack: Math.min(s.activeTrack, (patch.tracks ?? s.tracks ?? []).length),
      past: grouped ? s.past : [...s.past, s.snapshot()].slice(-HISTORY_LIMIT),
      future: [],
    }));
  }

  /** Substitui a faixa extra `ti` (1-based). */
  function patchTrack(ti: number, fn: (tr: VideoTrack) => VideoTrack) {
    const tracks = get().tracks ?? [];
    const tr = tracks[ti - 1];
    if (!tr) return;
    const next = fn(tr);
    if (next !== tr) commit({ tracks: tracks.map((x, j) => (j === ti - 1 ? next : x)) });
  }

  /** Aplica mudança de enquadramento na faixa ativa. */
  function patchFraming(fn: (f: Framing) => Partial<Framing>) {
    const ti = get().activeTrack;
    if (ti === 0) commit(fn(get()));
    else patchTrack(ti, (tr) => ({ ...tr, ...fn(tr) }));
  }

  return {
    ...defaultState(0),
    tracks: [],
    keyframes: [],
    activeTrack: 0,
    composition: undefined,
    compositionSegments: undefined,
    selectedLayout: -1,
    imageOverlays: [],
    textOverlays: [],
    activePaneId: "pane-1",
    duration: 0,
    currentTime: 0,
    playing: false,
    past: [],
    future: [],
    init: (duration, saved) => {
      const base = defaultState(duration);
      const raw = saved?.segments ?? (saved?.trim ? [saved.trim] : base.segments);
      const segments = normalizeSegments(raw, duration);
      // O principal é sempre tela cheia; layouts antigos ("cam + jogo") são descartados.
      const savedTracks = saved?.tracks ?? [];
      const layout = "full" as const;
      set({
        duration,
        currentTime: segments[0]!.start,
        segments,
        layout,
        camPos: saved?.camPos ?? base.camPos,
        audio: saved?.audio ? normalizeAudio(saved.audio, duration) : null,
        crops: fitCrops({ ...base.crops, ...saved?.crops }, layout),
        keyframes: fitKeyframes(saved?.keyframes, layout),
        composition: saved?.composition?.length ? saved.composition : undefined,
        compositionSegments: saved?.compositionSegments?.length ? saved.compositionSegments : undefined,
        selectedLayout: -1,
        captionPosition: saved?.captionPosition ?? base.captionPosition,
        imageOverlays: saved?.imageOverlays ?? [],
        textOverlays: saved?.textOverlays ?? [],
        activePaneId: saved?.composition?.[0]?.id ?? "pane-1",
        tracks: savedTracks.map((tr) => ({
          ...tr,
          id: tr.id || `t${++trackSeq}`,
          layout: "cam_game" as const,
          segments: normalizeAudio(tr.segments, duration),
          crops: fitCrops({ ...base.crops, ...tr.crops }, "cam_game"),
          keyframes: fitKeyframes(tr.keyframes, "cam_game"),
        })),
        activeTrack: 0,
        past: [],
        future: [],
      });
    },
    setSegments: (segments) =>
      commit({ segments: normalizeSegments(segments, get().duration) }),
    setSegmentEdge: (i, which, t) => {
      const segs = get().segments;
      const s = segs[i];
      if (!s) return;
      // Limita a borda entre os vizinhos para não fundir segmentos sem querer.
      const lo = which === "start" ? (segs[i - 1]?.end ?? 0) : s.start + MIN_SEGMENT;
      const hi = which === "start" ? s.end - MIN_SEGMENT : (segs[i + 1]?.start ?? get().duration);
      const v = Math.min(hi, Math.max(lo, t));
      const next = segs.map((x, j) => (j === i ? { ...x, [which]: v } : x));
      commit({ segments: normalizeSegments(next, get().duration) });
    },
    split: (t) => {
      const segs = get().segments;
      const next = splitAt(segs, t);
      if (next !== segs) commit({ segments: next });
    },
    removeAt: (i) => {
      const segs = get().segments;
      const next = removeSegment(segs, i);
      if (next !== segs) commit({ segments: next });
    },
    detachAudio: () => {
      if (get().audio) return;
      commit({ audio: get().segments.map((x) => ({ ...x })) });
    },
    linkAudio: () => {
      if (get().audio) commit({ audio: null });
    },
    splitAudio: (t) => {
      const segs = get().audio;
      if (!segs) return;
      const next = splitAt(segs, t);
      if (next !== segs) commit({ audio: next });
    },
    removeAudioAt: (i) => {
      const segs = get().audio;
      // Áudio pode ficar vazio (vídeo mudo).
      if (segs?.[i]) commit({ audio: segs.filter((_, j) => j !== i) });
    },
    setAudioSegmentEdge: (i, which, t) => {
      const segs = get().audio;
      const s = segs?.[i];
      if (!segs || !s) return;
      const lo = which === "start" ? (segs[i - 1]?.end ?? 0) : s.start + MIN_SEGMENT;
      const hi = which === "start" ? s.end - MIN_SEGMENT : (segs[i + 1]?.start ?? get().duration);
      const v = Math.min(hi, Math.max(lo, t));
      const next = segs.map((x, j) => (j === i ? { ...x, [which]: v } : x));
      commit({ audio: normalizeAudio(next, get().duration) });
    },
    addTrack: (t) => {
      const { duration, currentTime } = get();
      // A cam nova parte do enquadramento visível agora, sem herdar keyframes.
      const crops = cropsAt(get(), currentTime);
      const start = Math.max(0, Math.min(t, duration - MIN_SEGMENT));
      const end = Math.min(duration, start + NEW_TRACK_SECONDS);
      const tracks = get().tracks ?? [];
      const tr: VideoTrack = {
        id: `t${++trackSeq}`,
        segments: normalizeAudio([{ start, end }], duration),
        layout: "cam_game",
        camPos: "top",
        crops: fitCrops(crops, "cam_game"),
      };
      lastCommit = 0;
      commit({ tracks: [...tracks, tr] });
      set({ activeTrack: tracks.length + 1 });
    },
    removeTrack: (ti) => {
      const tracks = get().tracks ?? [];
      if (!tracks[ti - 1]) return;
      commit({ tracks: tracks.filter((_, j) => j !== ti - 1) });
      set({ activeTrack: 0 });
    },
    setActiveTrack: (ti) =>
      set({ activeTrack: Math.max(0, Math.min(ti, (get().tracks ?? []).length)) }),
    splitTrack: (ti, t) =>
      patchTrack(ti, (tr) => {
        const segs = splitAt(tr.segments, t);
        return segs === tr.segments ? tr : { ...tr, segments: segs };
      }),
    removeTrackSegment: (ti, i) =>
      patchTrack(ti, (tr) =>
        tr.segments[i] ? { ...tr, segments: tr.segments.filter((_, j) => j !== i) } : tr,
      ),
    setTrackSegmentEdge: (ti, i, which, t) =>
      patchTrack(ti, (tr) => {
        const segs = tr.segments;
        const s = segs[i];
        if (!s) return tr;
        const lo = which === "start" ? (segs[i - 1]?.end ?? 0) : s.start + MIN_SEGMENT;
        const hi = which === "start" ? s.end - MIN_SEGMENT : (segs[i + 1]?.start ?? get().duration);
        const v = Math.min(hi, Math.max(lo, t));
        const next = segs.map((x, j) => (j === i ? { ...x, [which]: v } : x));
        return { ...tr, segments: normalizeAudio(next, get().duration) };
      }),
    activeFraming: () => {
      const s = get();
      return (s.activeTrack > 0 && s.tracks?.[s.activeTrack - 1]) || s;
    },
    setLayout: (layout) =>
      patchFraming((f) => ({ layout, crops: fitCrops(f.crops, layout), keyframes: fitKeyframes(f.keyframes, layout) })),
    setCamPos: (camPos) => patchFraming(() => ({ camPos })),
    setComposition: (preset, srcW = 1920, srcH = 1080) => {
      // Se o playhead está dentro de um segmento de layout, edita esse segmento.
      const segs = get().compositionSegments;
      const t = get().currentTime;
      const si = segs?.findIndex((s) => t >= s.start && t < s.end) ?? -1;
      if (si >= 0 && segs) {
        const panes = panesForPreset(preset, srcW, srcH);
        lastCommit = 0;
        commit({ compositionSegments: segs.map((s, i) => i === si ? { ...s, panes } : s) });
        set({ activePaneId: panes[0]?.id ?? "pane-1" });
        return;
      }
      lastCommit = 0;
      commit({ composition: preset === "full" ? undefined : panesForPreset(preset, srcW, srcH), layout: "full", tracks: [] });
      set({ activeTrack: 0, activePaneId: "pane-1" });
    },
    addCompositionLayout: (preset, srcW = 1920, srcH = 1080) => {
      const segs = get().compositionSegments ?? [];
      const t = get().currentTime;
      const duration = get().duration;
      if (segs.some((s) => t >= s.start && t < s.end)) return; // já há layout aqui
      const nextStart = segs.filter((s) => s.start > t).reduce((m, s) => Math.min(m, s.start), duration);
      const end = Math.min(duration, Math.max(t + MIN_SEGMENT, Math.min(nextStart, t + 5)));
      if (end - t < MIN_SEGMENT) return;
      const panes = panesForPreset(preset, srcW, srcH);
      const next = [...segs, { id: `lay-${++overlaySeq}`, start: t, end, panes }].sort((a, b) => a.start - b.start);
      lastCommit = 0;
      commit({ compositionSegments: next });
      set({ selectedLayout: next.findIndex((s) => s.start === t), activePaneId: panes[0]?.id ?? "pane-1" });
    },
    removeCompositionLayout: (index) => {
      const segs = get().compositionSegments;
      if (!segs?.[index]) return;
      const next = segs.filter((_, i) => i !== index);
      commit({ compositionSegments: next.length ? next : undefined });
      set({ selectedLayout: -1 });
    },
    setCompositionLayoutEdge: (index, which, value) => {
      const segs = get().compositionSegments;
      const seg = segs?.[index];
      if (!segs || !seg) return;
      const duration = get().duration;
      const prevEnd = index > 0 ? segs[index - 1]!.end : 0;
      const nextStart = index < segs.length - 1 ? segs[index + 1]!.start : duration;
      const start = which === "start" ? Math.max(prevEnd, Math.min(value, seg.end - MIN_SEGMENT)) : seg.start;
      const end = which === "end" ? Math.min(nextStart, Math.max(value, seg.start + MIN_SEGMENT)) : seg.end;
      commit({ compositionSegments: segs.map((s, i) => i === index ? { ...s, start, end } : s) });
    },
    selectLayout: (index) => set({ selectedLayout: index }),
    setActivePane: (id) => set({ activePaneId: id }),
    setPaneCrop: (id, rect) => {
      const segs = get().compositionSegments;
      const t = get().currentTime;
      const si = segs?.findIndex((s) => t >= s.start && t < s.end) ?? -1;
      if (si >= 0 && segs) {
        commit({ compositionSegments: segs.map((s, i) => i === si
          ? { ...s, panes: s.panes.map((p) => p.id === id ? { ...p, crop: clampRect(rect) } : p) }
          : s) });
        return;
      }
      if (!get().composition?.length && (id === "game" || id === "cam")) {
        get().setCrop(id, rect);
        return;
      }
      const panes = get().composition ?? panesForPreset("full");
      if (!panes.some((p) => p.id === id)) return;
      commit({ composition: panes.map((p) => p.id === id ? { ...p, crop: clampRect(rect) } : p) });
    },
    setPaneDestination: (id, rect) => {
      const segs = get().compositionSegments;
      const t = get().currentTime;
      const si = segs?.findIndex((s) => t >= s.start && t < s.end) ?? -1;
      if (si >= 0 && segs) {
        commit({ compositionSegments: segs.map((s, i) => i === si
          ? { ...s, panes: s.panes.map((p) => p.id === id ? { ...p, destination: clampRect(rect) } : p) }
          : s) });
        return;
      }
      const panes = get().composition;
      if (!panes?.length || !panes.some((p) => p.id === id)) return;
      commit({ composition: panes.map((p) => p.id === id ? { ...p, destination: clampRect(rect) } : p) });
    },
    setPaneSource: (id, source) => {
      const apply = (p: FocusPane): FocusPane =>
        p.id === id ? { ...p, source: source && source.kind !== "clip" ? source : undefined } : p;
      const segs = get().compositionSegments;
      const t = get().currentTime;
      const si = segs?.findIndex((s) => t >= s.start && t < s.end) ?? -1;
      if (si >= 0 && segs) {
        commit({ compositionSegments: segs.map((s, i) => i === si ? { ...s, panes: s.panes.map(apply) } : s) });
        return;
      }
      const panes = get().composition;
      if (!panes?.length || !panes.some((p) => p.id === id)) return;
      commit({ composition: panes.map(apply) });
    },
    setCaptionPosition: (position) => commit({ captionPosition: {
      x: Math.min(1, Math.max(0, position.x)),
      y: Math.min(1, Math.max(0, position.y)),
    } }),
    addImageOverlay: (src, width, height) => {
      const duration = get().duration;
      const maxWidth = 0.42;
      const aspect = width > 0 && height > 0 ? width / height : 1;
      const w = maxWidth;
      const h = Math.min(0.42, w / aspect);
      const start = get().currentTime;
      const end = Math.min(duration, Math.max(start + MIN_SEGMENT, duration));
      const overlay: ImageOverlay = {
        id: `img-${++overlaySeq}`,
        src,
        start,
        end,
        x: 0.78,
        y: 0.84,
        width: w,
        height: h,
        opacity: 1,
      };
      commit({ imageOverlays: [...(get().imageOverlays ?? []), overlay] });
    },
    updateImageOverlay: (id, patch) => commit({
      imageOverlays: (get().imageOverlays ?? []).map((item) => item.id === id ? {
        ...item,
        ...patch,
        x: patch.x == null ? item.x : Math.min(1, Math.max(0, patch.x)),
        y: patch.y == null ? item.y : Math.min(1, Math.max(0, patch.y)),
        width: patch.width == null ? item.width : Math.min(1, Math.max(0.03, patch.width)),
        height: patch.height == null ? item.height : Math.min(1, Math.max(0.03, patch.height)),
        opacity: patch.opacity == null ? item.opacity : Math.min(1, Math.max(0, patch.opacity)),
        start: patch.start == null ? item.start : Math.max(0, Math.min(item.end - MIN_SEGMENT, patch.start)),
        end: patch.end == null ? item.end : Math.min(get().duration, Math.max(item.start + MIN_SEGMENT, patch.end)),
      } : item),
    }),
    removeImageOverlay: (id) => commit({ imageOverlays: (get().imageOverlays ?? []).filter((item) => item.id !== id) }),
    setImageOverlayEdge: (id, which, value) => {
      const item = (get().imageOverlays ?? []).find((x) => x.id === id);
      if (!item) return;
      if (which === "start") get().updateImageOverlay(id, { start: value });
      else get().updateImageOverlay(id, { end: value });
    },
    addTextOverlay: () => {
      const duration = get().duration;
      const start = get().currentTime;
      const end = Math.min(duration, Math.max(start + MIN_SEGMENT, start + 3));
      const overlay: TextOverlay = {
        id: `txt-${++overlaySeq}`,
        text: "Novo texto",
        start,
        end,
        x: 0.5,
        y: 0.5,
        size: 0.06,
        width: 0.8,
        color: "#ffffff",
        font: "sans",
        bg: "box",
        bgColor: "#000000",
        bgOpacity: 0.55,
      };
      commit({ textOverlays: [...(get().textOverlays ?? []), overlay] });
    },
    updateTextOverlay: (id, patch) => commit({
      textOverlays: (get().textOverlays ?? []).map((item) => item.id === id ? {
        ...item,
        ...patch,
        x: patch.x == null ? item.x : Math.min(1, Math.max(0, patch.x)),
        y: patch.y == null ? item.y : Math.min(1, Math.max(0, patch.y)),
        size: patch.size == null ? item.size : Math.min(0.4, Math.max(0.015, patch.size)),
        width: patch.width == null ? item.width : Math.min(1, Math.max(0.05, patch.width)),
        bgOpacity: patch.bgOpacity == null ? item.bgOpacity : Math.min(1, Math.max(0, patch.bgOpacity)),
        start: patch.start == null ? item.start : Math.max(0, Math.min(item.end - MIN_SEGMENT, patch.start)),
        end: patch.end == null ? item.end : Math.min(get().duration, Math.max(item.start + MIN_SEGMENT, patch.end)),
      } : item),
    }),
    removeTextOverlay: (id) => commit({ textOverlays: (get().textOverlays ?? []).filter((item) => item.id !== id) }),
    setTextOverlayEdge: (id, which, value) => {
      const item = (get().textOverlays ?? []).find((x) => x.id === id);
      if (!item) return;
      if (which === "start") get().updateTextOverlay(id, { start: value });
      else get().updateTextOverlay(id, { end: value });
    },
    setCrop: (key, rect) =>
      patchFraming((f) => {
        if (!f.keyframes?.length) return { crops: { ...f.crops, [key]: clampRect(rect) } };
        const t = get().currentTime;
        const base = cropsAt(f, t);
        return { keyframes: upsertKeyframe(f.keyframes, t, { ...base, [key]: clampRect(rect) }) };
      }),
    addKeyframe: () => {
      const t = get().currentTime;
      const f = get().activeFraming();
      if (keyframeIndexAt(f.keyframes, t) >= 0) return;
      lastCommit = 0;
      patchFraming(() => ({ keyframes: upsertKeyframe(f.keyframes, t, cropsAt(f, t)) }));
    },
    removeKeyframe: () => {
      const t = get().currentTime;
      const f = get().activeFraming();
      const next = removeKeyframeAt(f.keyframes, t);
      if (next === (f.keyframes ?? [])) return;
      lastCommit = 0;
      // Ao remover o último, os crops fixos passam a ser o enquadramento visível agora.
      patchFraming(() => (next.length ? { keyframes: next } : { keyframes: [], crops: cropsAt(f, t) }));
    },
    clearKeyframes: () => {
      const f = get().activeFraming();
      if (!f.keyframes?.length) return;
      lastCommit = 0;
      patchFraming(() => ({ keyframes: [], crops: cropsAt(f, get().currentTime) }));
    },
    applyPreset: (preset) => {
      const { currentTime: t0, duration } = get();
      const p = MOTION_PRESETS.find((x) => x.id === preset);
      if (!p) return;
      lastCommit = 0;
      patchFraming((f) => ({ keyframes: applyMotionPreset(f, preset, t0, Math.min(t0 + p.seconds, duration)) }));
    },
    autoZoomPeaks: (peaks, strength) => {
      if (!peaks.length) return;
      lastCommit = 0;
      patchFraming((f) => ({ keyframes: peakKeyframes(f, peaks, strength) }));
    },
    setCamRect: (rect) => {
      lastCommit = 0;
      patchFraming((f) => {
        const layout = f.layout === "full" ? "cam_game" : f.layout;
        const crops = fitCrops({ ...f.crops, cam: rect }, layout);
        const keyframes = f.keyframes?.map((k) => ({ ...k, crops: { ...k.crops, cam: crops.cam } }));
        return { layout, crops, keyframes: fitKeyframes(keyframes, layout) };
      });
    },
    resetEdit: () => {
      const base = defaultState(get().duration);
      const segments = normalizeSegments(base.segments, get().duration);
      lastCommit = 0;
      commit({
        segments,
        layout: "full",
        camPos: base.camPos,
        audio: null,
        crops: fitCrops(base.crops, "full"),
        keyframes: [],
        tracks: [],
        composition: undefined,
        compositionSegments: undefined,
        captionPosition: base.captionPosition,
        imageOverlays: [],
        textOverlays: [],
      });
      set({ activeTrack: 0, activePaneId: "pane-1", selectedLayout: -1, currentTime: segments[0]!.start });
    },
    setTime: (currentTime) => set({ currentTime }),
    setPlaying: (playing) => set({ playing }),
    undo: () => {
      const { past, future, snapshot } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      lastCommit = 0;
      set({ ...prev, past: past.slice(0, -1), future: [snapshot(), ...future] });
    },
    redo: () => {
      const { past, future, snapshot } = get();
      const next = future[0];
      if (!next) return;
      lastCommit = 0;
      set({ ...next, past: [...past, snapshot()], future: future.slice(1) });
    },
    snapshot: () => {
      const { segments, layout, camPos, crops, audio, tracks, keyframes, composition, compositionSegments, captionPosition, imageOverlays, textOverlays } = get();
      return { segments, layout, camPos, crops, keyframes: keyframes ?? [], audio: audio ?? null, tracks: tracks ?? [], composition: composition ?? [], compositionSegments: compositionSegments ?? [], captionPosition: captionPosition ?? { x: 0.5, y: 0.88 }, imageOverlays: imageOverlays ?? [], textOverlays: textOverlays ?? [] };
    },
  };
});
