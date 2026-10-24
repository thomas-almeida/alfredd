/** Layouts de saída 9:16 e geometria pura (testável, sem DOM). */

export const OUT_W = 1080;
export const OUT_H = 1920;
export const MAX_CLIP_SECONDS = 90;
/** Altura da faixa da cam no layout cam_game. */
export const CAM_H = 640;
export type FocusPreset = "full" | "split_vertical" | "split_horizontal" | "grid_2x2";

/** `cam` = só a cam, centralizada (trechos de cam sem vídeo principal). */
export type Layout = "full" | "cam_game" | "cam";
/** Posição da faixa da cam no layout cam_game. */
export type CamPos = "top" | "bottom";

/** Retângulo normalizado (0–1) sobre o frame de origem. */
export interface NRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CaptionPosition {
  /** Posição normalizada do centro da legenda no canvas final. */
  x: number;
  y: number;
}

/** Um foco independente sobre a mesma fonte de vídeo. */
export interface FocusPane {
  id: string;
  crop: NRect;
  /** Retângulo normalizado no canvas final 1080×1920. */
  destination: NRect;
  zIndex: number;
}

export interface Trim {
  start: number;
  end: number;
}

export interface EditorState {
  /** Trechos mantidos do clipe, em ordem e sem sobreposição. */
  segments: Trim[];
  layout: Layout;
  camPos: CamPos;
  crops: { game: NRect; cam: NRect };
  /**
   * Trechos de áudio (tempo da fonte), usados como máscara sobre os segmentos
   * de vídeo. `null`/ausente = áudio vinculado ao vídeo.
   */
  audio?: Trim[] | null;
  /**
   * Faixas de vídeo extras, empilhadas sobre a principal. Cada uma tem trechos
   * em tempo da fonte e enquadramento próprio; a faixa mais alta que cobre o
   * instante define o enquadramento do frame.
   */
  tracks?: VideoTrack[];
  /** Keyframes de crop do vídeo principal (ver `Framing.keyframes`). */
  keyframes?: Keyframe[];
  /** Composição simultânea de focos; ausente em projetos antigos. */
  composition?: FocusPane[];
  /** Posição normalizada do centro das legendas no canvas final. */
  captionPosition?: CaptionPosition;
}

/** Crops fixados num instante `t` (tempo da fonte). */
export interface Keyframe {
  t: number;
  crops: { game: NRect; cam: NRect };
}

export interface Framing {
  layout: Layout;
  camPos: CamPos;
  crops: { game: NRect; cam: NRect };
  /**
   * Keyframes ordenados por `t`. Vazio/ausente = crops fixos. Com keyframes,
   * os crops são interpolados entre eles e `crops` é ignorado.
   */
  keyframes?: Keyframe[];
}

export interface VideoTrack extends Framing {
  id: string;
  segments: Trim[];
}

/** Região de destino em pixels no canvas 1080×1920. */
export interface Slot {
  key: "game" | "cam";
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export function slotsFor(layout: Layout, camPos: CamPos = "top"): Slot[] {
  if (layout === "full") {
    return [{ key: "game", dx: 0, dy: 0, dw: OUT_W, dh: OUT_H }];
  }
  if (layout === "cam") {
    return [{ key: "cam", dx: 0, dy: (OUT_H - CAM_H) / 2, dw: OUT_W, dh: CAM_H }];
  }
  const gameH = OUT_H - CAM_H;
  return camPos === "top"
    ? [
        { key: "cam", dx: 0, dy: 0, dw: OUT_W, dh: CAM_H },
        { key: "game", dx: 0, dy: CAM_H, dw: OUT_W, dh: gameH },
      ]
    : [
        { key: "game", dx: 0, dy: 0, dw: OUT_W, dh: gameH },
        { key: "cam", dx: 0, dy: gameH, dw: OUT_W, dh: CAM_H },
      ];
}

function focusPane(id: string, crop: NRect, destination: NRect, zIndex = 0): FocusPane {
  return { id, crop, destination, zIndex };
}

/** Presets iniciais para dividir o mesmo vídeo em vários enquadramentos. */
export function panesForPreset(preset: FocusPreset, srcW = 1920, srcH = 1080): FocusPane[] {
  const cells = preset === "split_vertical"
    ? [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }]
    : preset === "split_horizontal"
      ? [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }]
      : preset === "grid_2x2"
        ? [
            { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 },
            { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
          ]
        : [{ x: 0, y: 0, w: 1, h: 1 }];
  return cells.map((destination, i) => focusPane(
    `pane-${i + 1}`,
    centeredCrop(srcW, srcH, destination.w * OUT_W, destination.h * OUT_H),
    destination,
    i,
  ));
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Mantém o retângulo dentro de [0,1] preservando o tamanho quando possível. */
export function clampRect(r: NRect): NRect {
  const w = clamp(r.w, 0.02, 1);
  const h = clamp(r.h, 0.02, 1);
  return { x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h), w, h };
}

/**
 * Crop normalizado centralizado com a proporção do slot, cabendo no frame de
 * origem (srcW×srcH). Usado como crop padrão.
 */
export function centeredCrop(
  srcW: number,
  srcH: number,
  slotW: number,
  slotH: number,
): NRect {
  const target = slotW / slotH;
  let wPx = srcW;
  let hPx = wPx / target;
  if (hPx > srcH) {
    hPx = srcH;
    wPx = hPx * target;
  }
  const w = wPx / srcW;
  const h = hPx / srcH;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** Ajusta a altura normalizada para manter a proporção do slot dado a largura. */
export function lockAspect(
  r: NRect,
  srcW: number,
  srcH: number,
  slotW: number,
  slotH: number,
): NRect {
  const h = (r.w * srcW * slotH) / slotW / srcH;
  return clampRect({ ...r, h });
}

/**
 * Reajusta o crop para a proporção do slot mantendo o centro (evita esticar
 * a imagem quando o slot muda, ex.: ao trocar de layout). Encolhe se não couber.
 */
export function fitToSlot(
  r: NRect,
  srcW: number,
  srcH: number,
  slotW: number,
  slotH: number,
): NRect {
  const fit = centeredCrop(srcW, srcH, slotW, slotH);
  const w = Math.min(r.w, fit.w);
  const h = (w * srcW * slotH) / slotW / srcH;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h });
}

/** Ajusta todos os crops às proporções dos slots do layout. */
export function fitCrops(
  crops: EditorState["crops"],
  layout: Layout,
  srcW = 1920,
  srcH = 1080,
): EditorState["crops"] {
  const out = { ...crops };
  for (const s of slotsFor(layout)) out[s.key] = fitToSlot(crops[s.key], srcW, srcH, s.dw, s.dh);
  return out;
}

/** Distância mínima entre keyframes; mais perto que isso é o mesmo keyframe. */
export const KEYFRAME_EPS = 1 / 30;

/** Suavização in-out (cúbica) para a transição entre keyframes. */
export const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

function lerpRect(a: NRect, b: NRect, u: number): NRect {
  return clampRect({
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    w: a.w + (b.w - a.w) * u,
    h: a.h + (b.h - a.h) * u,
  });
}

/** Crops vigentes em `t`: fixos sem keyframes; senão, interpolados entre os vizinhos. */
export function cropsAt(f: Pick<Framing, "crops" | "keyframes">, t: number): Framing["crops"] {
  const kfs = f.keyframes;
  if (!kfs?.length) return f.crops;
  const first = kfs[0]!;
  if (t <= first.t) return first.crops;
  const last = kfs[kfs.length - 1]!;
  if (t >= last.t) return last.crops;
  let i = 1;
  while (kfs[i]!.t < t) i++;
  const a = kfs[i - 1]!;
  const b = kfs[i]!;
  const u = ease((t - a.t) / (b.t - a.t));
  return { game: lerpRect(a.crops.game, b.crops.game, u), cam: lerpRect(a.crops.cam, b.crops.cam, u) };
}

/** Índice do keyframe a menos de `KEYFRAME_EPS` de `t`, ou -1. */
export function keyframeIndexAt(kfs: Keyframe[] | undefined, t: number): number {
  return kfs?.findIndex((k) => Math.abs(k.t - t) < KEYFRAME_EPS) ?? -1;
}

/** Insere (ordenado) ou substitui o keyframe em `t`. Não altera o array original. */
export function upsertKeyframe(kfs: Keyframe[] | undefined, t: number, crops: Keyframe["crops"]): Keyframe[] {
  const list = kfs ?? [];
  const i = keyframeIndexAt(list, t);
  if (i >= 0) return list.map((k, j) => (j === i ? { t: k.t, crops } : k));
  return [...list, { t, crops }].sort((a, b) => a.t - b.t);
}

/** Remove o keyframe em `t`; devolve o mesmo array se não houver nenhum lá. */
export function removeKeyframeAt(kfs: Keyframe[] | undefined, t: number): Keyframe[] {
  const list = kfs ?? [];
  const i = keyframeIndexAt(list, t);
  return i < 0 ? list : list.filter((_, j) => j !== i);
}

/** `fitCrops` aplicado a cada keyframe (ao trocar de layout ou carregar). */
export function fitKeyframes(kfs: Keyframe[] | undefined, layout: Layout): Keyframe[] {
  return (kfs ?? [])
    .filter((k) => Number.isFinite(k.t))
    .map((k) => ({ t: k.t, crops: fitCrops(k.crops, layout) }))
    .sort((a, b) => a.t - b.t);
}

export function defaultState(
  duration: number,
  srcW = 1920,
  srcH = 1080,
): EditorState {
  const end = Math.min(duration, MAX_CLIP_SECONDS);
  return {
    segments: [{ start: 0, end }],
    layout: "full",
    camPos: "top",
    audio: null,
    crops: {
      game: centeredCrop(srcW, srcH, OUT_W, OUT_H),
      cam: { x: 0, y: 0, w: 0.3, h: (0.3 * srcW * CAM_H) / OUT_W / srcH },
    },
    captionPosition: { x: 0.5, y: 0.88 },
  };
}

/** Normaliza o trim: start < end, dentro da duração, no máximo 90s. */
export function clampTrim(t: Trim, duration: number): Trim {
  const start = clamp(t.start, 0, Math.max(0, duration - 0.1));
  let end = clamp(t.end, start + 0.1, duration);
  if (end - start > MAX_CLIP_SECONDS) end = start + MAX_CLIP_SECONDS;
  return { start, end };
}

/** Duração mínima de um segmento, em segundos. */
export const MIN_SEGMENT = 0.1;

/** Soma das durações dos segmentos. */
export function segmentsTotal(segs: Trim[]): number {
  return segs.reduce((acc, s) => acc + (s.end - s.start), 0);
}

/**
 * Normaliza os segmentos: ordena, limita à duração, descarta trechos curtos,
 * funde sobreposições e corta o excedente acima de 90s. Sempre retorna ao
 * menos um segmento.
 */
export function normalizeSegments(segs: Trim[], duration: number): Trim[] {
  const sorted = segs
    .map((s) => ({
      start: clamp(Math.min(s.start, s.end), 0, duration),
      end: clamp(Math.max(s.start, s.end), 0, duration),
    }))
    .filter((s) => s.end - s.start >= MIN_SEGMENT - 1e-9)
    .sort((a, b) => a.start - b.start);
  const merged: Trim[] = [];
  for (const s of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && s.start <= prev.end) prev.end = Math.max(prev.end, s.end);
    else merged.push({ ...s });
  }
  const out: Trim[] = [];
  let left = MAX_CLIP_SECONDS;
  for (const s of merged) {
    if (left < MIN_SEGMENT) break;
    const len = Math.min(s.end - s.start, left);
    out.push({ start: s.start, end: s.start + len });
    left -= len;
  }
  if (!out.length) return [clampTrim({ start: 0, end: MAX_CLIP_SECONDS }, duration)];
  return out;
}

/** Índice do segmento que contém `t`, ou -1. */
export function segmentIndexAt(segs: Trim[], t: number): number {
  return segs.findIndex((s) => t >= s.start && t < s.end);
}

/** Divide o segmento sob `t` em dois (exige 0,1s de cada lado). */
export function splitAt(segs: Trim[], t: number): Trim[] {
  const i = segmentIndexAt(segs, t);
  if (i < 0) return segs;
  const s = segs[i]!;
  if (t - s.start < MIN_SEGMENT || s.end - t < MIN_SEGMENT) return segs;
  return [...segs.slice(0, i), { start: s.start, end: t }, { start: t, end: s.end }, ...segs.slice(i + 1)];
}

/** Remove o segmento `i`, mantendo sempre ao menos um. */
export function removeSegment(segs: Trim[], i: number): Trim[] {
  if (segs.length <= 1 || i < 0 || i >= segs.length) return segs;
  return segs.filter((_, j) => j !== i);
}

/**
 * Próximo instante reproduzível a partir de `t`: o próprio `t` se estiver
 * dentro de um segmento, o início do próximo segmento, ou null se acabou.
 */
export function nextPlayable(segs: Trim[], t: number): number | null {
  for (const s of segs) {
    if (t < s.start) return s.start;
    if (t < s.end) return t;
  }
  return null;
}

/** Converte crop normalizado em pixels da origem (para CanvasSink/drawImage). */
export function cropToPixels(r: NRect, srcW: number, srcH: number) {
  return {
    sx: Math.round(r.x * srcW),
    sy: Math.round(r.y * srcH),
    sw: Math.max(1, Math.round(r.w * srcW)),
    sh: Math.max(1, Math.round(r.h * srcH)),
  };
}

/** `t` está dentro de algum dos trechos? */
export function inSegments(segs: Trim[], t: number): boolean {
  return segmentIndexAt(segs, t) >= 0;
}

/** Interseção de duas listas ordenadas de trechos. */
export function intersectSegments(a: Trim[], b: Trim[]): Trim[] {
  const out: Trim[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const x = a[i]!;
    const y = b[j]!;
    const start = Math.max(x.start, y.start);
    const end = Math.min(x.end, y.end);
    if (end > start) out.push({ start, end });
    if (x.end < y.end) i++;
    else j++;
  }
  return out;
}

/** Ordena, limita à duração e funde trechos de áudio (sem limite de 90s). */
export function normalizeAudio(segs: Trim[], duration: number): Trim[] {
  const sorted = segs
    .map((s) => ({ start: clamp(s.start, 0, duration), end: clamp(s.end, 0, duration) }))
    .filter((s) => s.end - s.start >= MIN_SEGMENT - 1e-9)
    .sort((a, b) => a.start - b.start);
  const out: Trim[] = [];
  for (const s of sorted) {
    const prev = out[out.length - 1];
    if (prev && s.start <= prev.end) prev.end = Math.max(prev.end, s.end);
    else out.push({ ...s });
  }
  return out;
}

/**
 * Enquadramento vigente no instante `t` (tempo da fonte). O vídeo principal é
 * sempre tela cheia; uma faixa de cam que cobre `t` sobrepõe a cam (a mais alta
 * vence) e, onde não há vídeo principal, a cam aparece sozinha e centralizada.
 */
export function framingAt(state: EditorState, t: number): Framing {
  const tracks = state.tracks ?? [];
  for (let i = tracks.length - 1; i >= 0; i--) {
    const tr = tracks[i]!;
    if (!inSegments(tr.segments, t)) continue;
    const crops = cropsAt(tr, t);
    if (!inSegments(state.segments, t)) return { ...tr, crops, layout: "cam" };
    // Sem keyframes devolve a própria faixa (sem alocar por frame).
    return crops === tr.crops ? tr : { ...tr, crops };
  }
  return { layout: "full", camPos: state.camPos, crops: cropsAt(state, t) };
}

/** Composição usada simultaneamente pelo preview e pelo export. */
export function compositionAt(state: EditorState, t: number): FocusPane[] {
  if (state.composition?.length) return state.composition;
  const f = framingAt(state, t);
  return slotsFor(f.layout, f.camPos).map((slot) => ({
    id: slot.key,
    crop: f.crops[slot.key],
    destination: { x: slot.dx / OUT_W, y: slot.dy / OUT_H, w: slot.dw / OUT_W, h: slot.dh / OUT_H },
    zIndex: slot.key === "game" ? 0 : 1,
  }));
}

/** Trechos que entram na saída: união do vídeo principal com as faixas de cam. */
export function outputSegments(state: EditorState): Trim[] {
  const all = [...state.segments, ...(state.tracks ?? []).flatMap((tr) => tr.segments)];
  return normalizeSegments(all, Number.MAX_VALUE);
}
