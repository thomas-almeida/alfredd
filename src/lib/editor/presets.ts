import {
  MIN_SEGMENT,
  type EditorState,
  type FocusPane,
  type CompositionSegment,
  type ImageOverlay,
  type TextOverlay,
  type CaptionPosition,
  type Layout,
  type CamPos,
  type Keyframe,
  type NRect,
} from "../export/layouts.ts";

/**
 * Parte "visual" do editor que vira um modelo reutilizável: focos/enquadramento,
 * layouts por tempo, textos, imagem/marca d'água e posição das legendas. Não
 * inclui nada específico do clipe (corte, áudio, duração) — só o "look".
 */
export interface EditorTemplate {
  layout: Layout;
  camPos: CamPos;
  crops: { game: NRect; cam: NRect };
  keyframes: Keyframe[];
  composition: FocusPane[];
  compositionSegments: CompositionSegment[];
  textOverlays: TextOverlay[];
  imageOverlays: ImageOverlay[];
  captionPosition: CaptionPosition;
  /** Duração (s) do clipe onde o modelo foi criado — base para reaprontar tempos. */
  refDuration: number;
}

const DEFAULT_CAPTION: CaptionPosition = { x: 0.5, y: 0.88 };

function clone<T>(v: T): T {
  // structuredClone existe no Node 18+ e em todos os navegadores suportados.
  return typeof structuredClone === "function"
    ? structuredClone(v)
    : (JSON.parse(JSON.stringify(v)) as T);
}

/** Extrai o modelo (o "look") do estado atual do editor. */
export function extractTemplate(state: EditorState, refDuration: number): EditorTemplate {
  return clone({
    layout: state.layout,
    camPos: state.camPos,
    crops: state.crops,
    keyframes: state.keyframes ?? [],
    composition: state.composition ?? [],
    compositionSegments: state.compositionSegments ?? [],
    textOverlays: state.textOverlays ?? [],
    imageOverlays: state.imageOverlays ?? [],
    captionPosition: state.captionPosition ?? DEFAULT_CAPTION,
    refDuration: Math.max(0, refDuration),
  });
}

/**
 * Reaponta o intervalo [start, end] de um item para uma nova duração, preservando
 * o início absoluto (ex.: texto nos "primeiros 10s" continua nos primeiros 10s) e
 * estendendo até o novo fim o que ia até o fim do clipe original (ex.: marca
 * d'água que cobria o clipe inteiro). Retorna null se não couber no novo clipe.
 */
export function rescaleSpan(
  start: number,
  end: number,
  refDuration: number,
  duration: number,
): { start: number; end: number } | null {
  if (duration < MIN_SEGMENT) return null;
  if (start >= duration) return null; // começa depois do fim do novo clipe
  const reachedEnd = refDuration > 0 && end >= refDuration - 0.05;
  let s = Math.max(0, Math.min(start, duration - MIN_SEGMENT));
  let e = reachedEnd ? duration : Math.min(end, duration);
  if (e - s < MIN_SEGMENT) {
    e = Math.min(duration, s + MIN_SEGMENT);
    if (e - s < MIN_SEGMENT) s = Math.max(0, e - MIN_SEGMENT);
  }
  return { start: s, end: e };
}

/**
 * Converte um modelo no patch de estado a aplicar num clipe de duração `duration`.
 * Reaponta os tempos e troca os ids dos itens com tempo para não colidir com os
 * contadores do editor (textos/imagens/layouts adicionados depois). `seed` existe
 * para tornar os ids determinísticos em testes.
 */
export function templatePatch(
  tpl: EditorTemplate,
  duration: number,
  seed: number = Date.now(),
): Partial<EditorState> {
  let n = 0;
  const id = (prefix: string) => `${prefix}-m${seed.toString(36)}-${n++}`;

  const textOverlays = clone(tpl.textOverlays).flatMap((o): TextOverlay[] => {
    const span = rescaleSpan(o.start, o.end, tpl.refDuration, duration);
    return span ? [{ ...o, ...span, id: id("txt") }] : [];
  });

  const imageOverlays = clone(tpl.imageOverlays).flatMap((o): ImageOverlay[] => {
    const span = rescaleSpan(o.start, o.end, tpl.refDuration, duration);
    return span ? [{ ...o, ...span, id: id("img") }] : [];
  });

  const compositionSegments = clone(tpl.compositionSegments).flatMap(
    (s): CompositionSegment[] => {
      const span = rescaleSpan(s.start, s.end, tpl.refDuration, duration);
      return span ? [{ ...s, ...span, id: id("lay") }] : [];
    },
  );

  return {
    layout: tpl.layout,
    camPos: tpl.camPos,
    crops: clone(tpl.crops),
    keyframes: clone(tpl.keyframes),
    composition: tpl.composition.length ? clone(tpl.composition) : undefined,
    compositionSegments: compositionSegments.length ? compositionSegments : undefined,
    textOverlays,
    imageOverlays,
    captionPosition: clone(tpl.captionPosition),
  };
}
