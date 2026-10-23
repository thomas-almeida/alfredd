/** Layouts de saída 9:16 e geometria pura (testável, sem DOM). */

export const OUT_W = 1080;
export const OUT_H = 1920;
export const MAX_CLIP_SECONDS = 90;
/** Altura da faixa da cam no layout cam_game. */
export const CAM_H = 640;

export type Layout = "full" | "cam_game";
/** Posição da faixa da cam no layout cam_game. */
export type CamPos = "top" | "bottom";

/** Retângulo normalizado (0–1) sobre o frame de origem. */
export interface NRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Trim {
  start: number;
  end: number;
}

export interface EditorState {
  trim: Trim;
  layout: Layout;
  camPos: CamPos;
  crops: { game: NRect; cam: NRect };
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

export function defaultState(
  duration: number,
  srcW = 1920,
  srcH = 1080,
): EditorState {
  const end = Math.min(duration, MAX_CLIP_SECONDS);
  return {
    trim: { start: 0, end },
    layout: "full",
    camPos: "top",
    crops: {
      game: centeredCrop(srcW, srcH, OUT_W, OUT_H),
      cam: { x: 0, y: 0, w: 0.3, h: (0.3 * srcW * CAM_H) / OUT_W / srcH },
    },
  };
}

/** Normaliza o trim: start < end, dentro da duração, no máximo 90s. */
export function clampTrim(t: Trim, duration: number): Trim {
  const start = clamp(t.start, 0, Math.max(0, duration - 0.1));
  let end = clamp(t.end, start + 0.1, duration);
  if (end - start > MAX_CLIP_SECONDS) end = start + MAX_CLIP_SECONDS;
  return { start, end };
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
