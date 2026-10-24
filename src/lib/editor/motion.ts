// Automações de movimento: presets, zoom nos picos de áudio e enquadramento da
// webcam. Tudo aqui é puro (sem DOM) para poder ser testado com node:test.
import {
  KEYFRAME_EPS,
  clampRect,
  cropsAt,
  fitToSlot,
  slotsFor,
  upsertKeyframe,
  type Framing,
  type Keyframe,
  type NRect,
  type Trim,
} from "../export/layouts.ts";

export type MotionPreset = "zoom_in" | "punch_in" | "pan_left" | "pan_right" | "zoom_out";

export const MOTION_PRESETS: { id: MotionPreset; label: string; seconds: number }[] = [
  { id: "zoom_in", label: "Zoom lento", seconds: 3 },
  { id: "punch_in", label: "Punch-in", seconds: 1.5 },
  { id: "pan_left", label: "Pan ←", seconds: 3 },
  { id: "pan_right", label: "Pan →", seconds: 3 },
  { id: "zoom_out", label: "Zoom out", seconds: 2 },
];

/** Duração do "soco" do punch-in até chegar no zoom. */
const PUNCH = 0.15;

/** Slot principal do layout (o que recebe o movimento). */
const mainKey = (layout: Framing["layout"]) => (layout === "cam" ? "cam" : "game");

/** Aproxima (k > 1) ou afasta (k < 1) mantendo centro e proporção. */
export function zoomRect(r: NRect, k: number): NRect {
  // Afastar além do frame distorceria a proporção ao clampar; limita o fator.
  const kk = Math.max(k, r.w, r.h);
  const w = r.w / kk;
  const h = r.h / kk;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h });
}

/** Desloca horizontalmente `d` (fração do frame), parando na borda. */
export function panRect(r: NRect, d: number): NRect {
  return clampRect({ ...r, x: r.x + d });
}

/** Remove os keyframes dentro de [t0, t1] (com folga de 1 frame). */
function clearRange(kfs: Keyframe[] | undefined, t0: number, t1: number): Keyframe[] {
  return (kfs ?? []).filter((k) => k.t < t0 - KEYFRAME_EPS || k.t > t1 + KEYFRAME_EPS);
}

function withMain(crops: Keyframe["crops"], key: "game" | "cam", r: NRect): Keyframe["crops"] {
  return { ...crops, [key]: r };
}

/**
 * Keyframes resultantes de aplicar `preset` em [t0, t1]. Parte do crop vigente
 * em t0, mexe só no slot principal e substitui os keyframes do trecho.
 */
export function applyMotionPreset(
  f: Pick<Framing, "crops" | "keyframes" | "layout">,
  preset: MotionPreset,
  t0: number,
  t1: number,
  strength = 1.35,
): Keyframe[] {
  if (!(t1 - t0 > KEYFRAME_EPS * 2)) return f.keyframes ?? [];
  const key = mainKey(f.layout);
  const base = cropsAt(f, t0);
  const r = base[key];
  const after = cropsAt(f, t1);
  let pts: [number, NRect][];
  switch (preset) {
    case "zoom_in":
      pts = [[t0, r], [t1, zoomRect(r, strength)]];
      break;
    case "punch_in": {
      const z = zoomRect(r, strength);
      pts = [[t0, r], [Math.min(t0 + PUNCH, t1), z], [t1, z]];
      break;
    }
    case "zoom_out":
      pts = [[t0, zoomRect(r, strength)], [t1, r]];
      break;
    case "pan_left":
    case "pan_right": {
      const d = (strength - 1) * 0.6 * (preset === "pan_left" ? -1 : 1);
      pts = [[t0, r], [t1, panRect(r, d)]];
      break;
    }
  }
  let out = clearRange(f.keyframes, t0, t1);
  // Sem keyframes depois do trecho, o último ponto valeria até o fim: fixa o
  // enquadramento anterior logo depois só quando já havia keyframes adiante.
  for (const [t, rect] of pts) out = upsertKeyframe(out, t, withMain(t === t1 ? after : base, key, rect));
  return out;
}

// ---------- Zoom nos picos de áudio ----------

/** RMS por janela de `hop` segundos (canal já mixado em mono). */
export function rmsEnvelope(samples: ArrayLike<number>, sampleRate: number, hop = 0.05): number[] {
  const n = Math.max(1, Math.round(sampleRate * hop));
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += n) {
    let s = 0;
    const end = Math.min(samples.length, i + n);
    for (let j = i; j < end; j++) s += samples[j]! * samples[j]!;
    out.push(Math.sqrt(s / (end - i)));
  }
  return out;
}

export interface PeakOptions {
  /** Segundos por amostra do envelope. */
  hop: number;
  /** 0–1: quanto maior, mais picos (limiar mais baixo). */
  intensity: number;
  /** Intervalo mínimo entre picos (s). */
  minGap?: number;
  /** Só considera picos dentro destes trechos. */
  within?: Trim[];
}

/**
 * Instantes (s) dos picos de volume: máximos locais acima de média + k·desvio,
 * com k caindo conforme a intensidade, espaçados por `minGap` (o mais alto vence).
 */
export function detectPeaks(env: number[], { hop, intensity, minGap = 1.5, within }: PeakOptions): number[] {
  const inRange = (t: number) => !within || within.some((s) => t >= s.start && t < s.end);
  const vals = env.filter((_, i) => inRange(i * hop));
  if (vals.length < 3) return [];
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  if (sd < 1e-6) return [];
  const k = 3 - 2 * Math.min(1, Math.max(0, intensity));
  const thr = mean + k * sd;
  const cands: { t: number; v: number }[] = [];
  for (let i = 1; i < env.length - 1; i++) {
    const v = env[i]!;
    if (v >= thr && v >= env[i - 1]! && v > env[i + 1]! && inRange(i * hop)) cands.push({ t: i * hop, v });
  }
  const picked: { t: number; v: number }[] = [];
  for (const c of cands.sort((a, b) => b.v - a.v)) {
    if (picked.every((p) => Math.abs(p.t - c.t) >= minGap)) picked.push(c);
  }
  return picked.map((p) => p.t).sort((a, b) => a - b);
}

/** Punch-in em cada pico: entra rápido, segura e volta suave. */
export function peakKeyframes(
  f: Pick<Framing, "crops" | "keyframes" | "layout">,
  peaks: number[],
  strength = 1.3,
  hold = 0.6,
  release = 0.4,
): Keyframe[] {
  const key = mainKey(f.layout);
  let out = f.keyframes ?? [];
  for (const p of peaks) {
    const t0 = Math.max(0, p - PUNCH);
    const t1 = p + hold + release;
    const base = cropsAt({ crops: f.crops, keyframes: out }, t0);
    const back = cropsAt({ crops: f.crops, keyframes: out }, t1);
    const z = zoomRect(base[key], strength);
    out = clearRange(out, t0, t1);
    out = upsertKeyframe(out, t0, base);
    out = upsertKeyframe(out, p, withMain(base, key, z));
    out = upsertKeyframe(out, p + hold, withMain(base, key, z));
    out = upsertKeyframe(out, t1, back);
  }
  return out;
}

// ---------- Webcam ----------

/**
 * Crop da cam a partir das caixas de rosto detectadas (normalizadas). Usa a
 * mediana das caixas (robusto a detecções soltas), expande `pad`× o rosto e
 * ajusta à proporção do slot da cam do layout cam_game.
 */
export function camRectFromFaces(faces: NRect[], srcW = 1920, srcH = 1080, pad = 2.6): NRect | null {
  if (!faces.length) return null;
  const med = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  };
  const cx = med(faces.map((r) => r.x + r.w / 2));
  const cy = med(faces.map((r) => r.y + r.h / 2));
  const fw = med(faces.map((r) => r.w));
  const fh = med(faces.map((r) => r.h));
  const slot = slotsFor("cam_game").find((s) => s.key === "cam")!;
  // Altura do crop ~pad× o rosto; a largura sai da proporção do slot.
  const h = Math.min(1, Math.max(fh, (fw * srcW) / srcH) * pad);
  const w = (h * srcH * slot.dw) / slot.dh / srcW;
  return fitToSlot(clampRect({ x: cx - w / 2, y: cy - h / 2, w, h }), srcW, srcH, slot.dw, slot.dh);
}
