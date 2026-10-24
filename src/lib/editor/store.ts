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
  type Trim,
  type VideoTrack,
  panesForPreset,
  type FocusPane,
  type FocusPreset,
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
  activePaneId: string;
  setComposition: (preset: FocusPreset, srcW?: number, srcH?: number) => void;
  setActivePane: (id: string) => void;
  setPaneCrop: (id: string, rect: NRect) => void;
}

let lastCommit = 0;
let trackSeq = 0;

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
      lastCommit = 0;
      commit({ composition: preset === "full" ? undefined : panesForPreset(preset, srcW, srcH), layout: "full", tracks: [] });
      set({ activeTrack: 0, activePaneId: "pane-1" });
    },
    setActivePane: (id) => set({ activePaneId: id }),
    setPaneCrop: (id, rect) => {
      const panes = get().composition ?? panesForPreset("full");
      if (!panes.some((p) => p.id === id)) return;
      commit({ composition: panes.map((p) => p.id === id ? { ...p, crop: clampRect(rect) } : p) });
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
      });
      set({ activeTrack: 0, activePaneId: "pane-1", currentTime: segments[0]!.start });
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
      const { segments, layout, camPos, crops, audio, tracks, keyframes, composition } = get();
      return { segments, layout, camPos, crops, keyframes: keyframes ?? [], audio: audio ?? null, tracks: tracks ?? [], composition: composition ?? [] };
    },
  };
});
