"use client";

import { create } from "zustand";
import {
  clampRect,
  clampTrim,
  defaultState,
  fitCrops,
  type CamPos,
  type EditorState,
  type Layout,
  type NRect,
} from "@/lib/export/layouts";

interface EditorStore extends EditorState {
  duration: number;
  currentTime: number;
  playing: boolean;
  init: (duration: number, saved?: Partial<EditorState> | null) => void;
  setTrim: (start: number, end: number) => void;
  setLayout: (layout: Layout) => void;
  setCamPos: (camPos: CamPos) => void;
  setCrop: (key: "game" | "cam", rect: NRect) => void;
  setTime: (t: number) => void;
  setPlaying: (p: boolean) => void;
  snapshot: () => EditorState;
}

export const useEditor = create<EditorStore>((set, get) => ({
  ...defaultState(0),
  duration: 0,
  currentTime: 0,
  playing: false,
  init: (duration, saved) => {
    const base = defaultState(duration);
    const layout = saved?.layout ?? base.layout;
    set({
      duration,
      currentTime: saved?.trim?.start ?? 0,
      trim: clampTrim(saved?.trim ?? base.trim, duration),
      layout,
      camPos: saved?.camPos ?? base.camPos,
      crops: fitCrops({ ...base.crops, ...saved?.crops }, layout),
    });
  },
  setTrim: (start, end) => set({ trim: clampTrim({ start, end }, get().duration) }),
  setLayout: (layout) => set((s) => ({ layout, crops: fitCrops(s.crops, layout) })),
  setCamPos: (camPos) => set({ camPos }),
  setCrop: (key, rect) =>
    set((s) => ({ crops: { ...s.crops, [key]: clampRect(rect) } })),
  setTime: (currentTime) => set({ currentTime }),
  setPlaying: (playing) => set({ playing }),
  snapshot: () => {
    const { trim, layout, camPos, crops } = get();
    return { trim, layout, camPos, crops };
  },
}));
