/** Layouts de saída 9:16 e geometria pura (testável, sem DOM). */

export const OUT_W = 1080;
export const OUT_H = 1920;
export const MAX_CLIP_SECONDS = 180;
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

/** Imagem sobreposta ao vídeo, em coordenadas normalizadas do canvas final. */
export interface ImageOverlay {
  id: string;
  /** Data URL ou URL pública de uma imagem aprovada pelo editor. */
  src: string;
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

export type TextFont = "sans" | "mono" | "serif" | "impact";
export type TextBg = "none" | "box" | "highlight";

/** Texto sobreposto ao vídeo, em coordenadas normalizadas do canvas final. */
export interface TextOverlay {
  id: string;
  text: string;
  start: number;
  end: number;
  /** Centro normalizado do bloco de texto. */
  x: number;
  y: number;
  /** Tamanho da fonte como fração da altura do canvas. */
  size: number;
  /** Largura máxima normalizada para quebra de linha. */
  width: number;
  color: string;
  font: TextFont;
  bg: TextBg;
  bgColor: string;
  bgOpacity: number;
}

/** Fonte de um quadro: recorte do vídeo principal (padrão), imagem ou vídeo externo. */
export type PaneSource =
  | { kind: "clip" }
  | { kind: "image"; src: string }
  | { kind: "video"; src: string; muted?: boolean; offset?: number };

/** Um foco independente sobre a mesma fonte de vídeo. */
export interface FocusPane {
  id: string;
  crop: NRect;
  /** Retângulo normalizado no canvas final 1080×1920. */
  destination: NRect;
  zIndex: number;
  /** Fonte do quadro; ausente/`clip` = recorte do vídeo principal (retrocompat). */
  source?: PaneSource;
}

/** Composição (conjunto de focos) válida num intervalo de tempo da fonte. */
export interface CompositionSegment {
  id: string;
  start: number;
  end: number;
  panes: FocusPane[];
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
  /** Composições por faixa de tempo; quando presentes, têm prioridade sobre `composition`. */
  compositionSegments?: CompositionSegment[];
  /** Posição normalizada do centro das legendas no canvas final. */
  captionPosition?: CaptionPosition;
  imageOverlays?: ImageOverlay[];
  textOverlays?: TextOverlay[];
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
  const segs = state.compositionSegments;
  if (segs?.length) {
    const seg = segs.find((s) => t >= s.start && t < s.end);
    // Segmento sem focos cai no padrão (evita frame preto); senão usa seus focos.
    if (seg && seg.panes.length) return seg.panes;
    // Fora de qualquer segmento: cai no padrão (global ou enquadramento).
  }
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

export function overlaysAt(state: EditorState, t: number): ImageOverlay[] {
  return (state.imageOverlays ?? []).filter((overlay) => t >= overlay.start && t < overlay.end);
}

export function textOverlaysAt(state: EditorState, t: number): TextOverlay[] {
  return (state.textOverlays ?? []).filter((o) => t >= o.start && t < o.end);
}

/** URLs únicas de imagens usadas como fonte de algum quadro (Fase 1C). */
export function paneImageSources(state: EditorState): string[] {
  const srcs = new Set<string>();
  const collect = (panes?: FocusPane[]) =>
    panes?.forEach((p) => { if (p.source?.kind === "image") srcs.add(p.source.src); });
  collect(state.composition);
  state.compositionSegments?.forEach((s) => collect(s.panes));
  return [...srcs];
}

/** Desenha uma imagem preenchendo o destino (object-fit: cover), cortando o excesso. */
export function drawImageCover(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  if (!iw || !ih) return;
  const ir = iw / ih;
  const dr = dw / dh;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (ir > dr) {
    sw = ih * dr;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / dr;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

const TEXT_FONT_FAMILY: Record<TextFont, string> = {
  sans: "system-ui, 'Segoe UI', Arial, sans-serif",
  mono: "ui-monospace, 'Consolas', 'Courier New', monospace",
  serif: "Georgia, 'Times New Roman', serif",
  impact: "Impact, 'Anton', 'Arial Narrow', sans-serif",
};

type AnyCanvasCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Quebra o texto em linhas que cabem em `maxWidth`, respeitando quebras manuais. */
export function wrapTextLines(ctx: AnyCanvasCtx, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let row = "";
    for (const word of words) {
      const candidate = row ? `${row} ${word}` : word;
      if (row && ctx.measureText(candidate).width > maxWidth) {
        out.push(row);
        row = word;
      } else {
        row = candidate;
      }
    }
    if (row) out.push(row);
  }
  return out;
}

function roundRectPath(ctx: AnyCanvasCtx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/**
 * Caixa (em px do canvas W×H) que envolve o texto desenhado, usando a MESMA
 * fonte/quebra/paddings de `drawTextOverlay` — assim a seleção no preview casa
 * exatamente com o texto renderizado.
 */
export function textOverlayBox(ctx: AnyCanvasCtx, o: TextOverlay, W: number, H: number) {
  const fontPx = Math.max(8, o.size * H);
  const weight = o.font === "impact" ? "800" : "700";
  ctx.font = `${weight} ${fontPx}px ${TEXT_FONT_FAMILY[o.font]}`;
  const maxWidth = Math.max(16, o.width * W);
  const lines = wrapTextLines(ctx, o.text || "", maxWidth);
  const lineHeight = fontPx * 1.2;
  const padX = fontPx * 0.35;
  const padY = fontPx * 0.22;
  const widths = lines.map((line) => ctx.measureText(line).width);
  const blockW = Math.max(1, ...widths);
  const w = blockW + padX * 2;
  const h = lines.length * lineHeight + padY * 2;
  return { left: o.x * W - w / 2, top: o.y * H - h / 2, w, h };
}

/**
 * Desenho único usado pelo preview e pelo export, garantindo que o texto saia
 * idêntico nos dois. `W`/`H` são as dimensões do canvas de destino.
 */
export function drawTextOverlay(ctx: AnyCanvasCtx, o: TextOverlay, W: number, H: number) {
  const fontPx = Math.max(8, o.size * H);
  const weight = o.font === "impact" ? "800" : "700";
  ctx.font = `${weight} ${fontPx}px ${TEXT_FONT_FAMILY[o.font]}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const maxWidth = Math.max(16, o.width * W);
  const lines = wrapTextLines(ctx, o.text || "", maxWidth);
  const lineHeight = fontPx * 1.2;
  const padX = fontPx * 0.35;
  const padY = fontPx * 0.22;
  const blockH = lines.length * lineHeight;
  const widths = lines.map((line) => ctx.measureText(line).width);
  const blockW = Math.max(1, ...widths);
  const cx = o.x * W;
  const top = o.y * H - blockH / 2;
  const alpha = Math.min(1, Math.max(0, o.bgOpacity));

  if (o.bg === "box") {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = o.bgColor;
    roundRectPath(ctx, cx - blockW / 2 - padX, top - padY, blockW + padX * 2, blockH + padY * 2, padY * 1.4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  lines.forEach((line, index) => {
    const ly = top + index * lineHeight + lineHeight / 2;
    if (o.bg === "highlight" && line) {
      const w = widths[index]!;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = o.bgColor;
      roundRectPath(ctx, cx - w / 2 - padX, ly - lineHeight / 2, w + padX * 2, lineHeight, padY);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = o.color;
    ctx.fillText(line, cx, ly);
  });
}
