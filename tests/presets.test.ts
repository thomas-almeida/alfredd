import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractTemplate,
  rescaleSpan,
  templatePatch,
  type EditorTemplate,
} from "../src/lib/editor/presets.ts";
import type {
  EditorState,
  FocusPane,
  ImageOverlay,
  TextOverlay,
  CompositionSegment,
} from "../src/lib/export/layouts.ts";

const RECT = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };

function pane(id: string): FocusPane {
  return { id, crop: RECT, destination: RECT, zIndex: 0 };
}

function img(over: Partial<ImageOverlay> = {}): ImageOverlay {
  return { id: "img-1", src: "x", start: 0, end: 60, x: 0.5, y: 0.5, width: 0.3, height: 0.3, opacity: 1, ...over };
}

function txt(over: Partial<TextOverlay> = {}): TextOverlay {
  return {
    id: "txt-1", text: "oi", start: 0, end: 10, x: 0.5, y: 0.5,
    size: 0.06, width: 0.8, color: "#fff", font: "sans", bg: "box", bgColor: "#000", bgOpacity: 0.5, ...over,
  };
}

function baseState(over: Partial<EditorState> = {}): EditorState {
  return {
    segments: [{ start: 0, end: 60 }],
    layout: "full",
    camPos: "top",
    crops: { game: RECT, cam: RECT },
    ...over,
  };
}

// ── extractTemplate ────────────────────────────────────────────────────────

test("extractTemplate captura o look e a duração de referência, sem o corte", () => {
  const state = baseState({
    composition: [pane("pane-1")],
    textOverlays: [txt()],
    imageOverlays: [img()],
    captionPosition: { x: 0.4, y: 0.9 },
  });
  const tpl = extractTemplate(state, 60);
  assert.equal(tpl.refDuration, 60);
  assert.equal(tpl.composition.length, 1);
  assert.equal(tpl.textOverlays.length, 1);
  assert.equal(tpl.imageOverlays.length, 1);
  assert.deepEqual(tpl.captionPosition, { x: 0.4, y: 0.9 });
  // Não deve existir "segments" no modelo (é específico do clipe).
  assert.equal("segments" in tpl, false);
});

test("extractTemplate clona (não referencia os arrays vivos do estado)", () => {
  const overlays = [txt()];
  const state = baseState({ textOverlays: overlays });
  const tpl = extractTemplate(state, 60);
  assert.notEqual(tpl.textOverlays, overlays);
  tpl.textOverlays[0]!.text = "mudado";
  assert.equal(overlays[0]!.text, "oi");
});

// ── rescaleSpan ────────────────────────────────────────────────────────────

test("rescaleSpan preserva um intro absoluto (primeiros 10s)", () => {
  // ref 60s, novo clipe 30s: 10 < 60 => não é 'até o fim', mantém 0..10.
  assert.deepEqual(rescaleSpan(0, 10, 60, 30), { start: 0, end: 10 });
});

test("rescaleSpan estende ao novo fim o que ia até o fim do clipe original", () => {
  // marca d'água 0..60 em clipe de ref 60 => cobre o clipe inteiro.
  assert.deepEqual(rescaleSpan(0, 60, 60, 30), { start: 0, end: 30 });
  assert.deepEqual(rescaleSpan(0, 60, 60, 120), { start: 0, end: 120 });
});

test("rescaleSpan devolve null quando o item começa depois do novo fim", () => {
  assert.equal(rescaleSpan(40, 50, 60, 30), null);
});

test("rescaleSpan garante duração mínima ao encostar no fim", () => {
  const span = rescaleSpan(29.98, 30, 30, 30)!;
  assert.ok(span.end - span.start >= 0.1 - 1e-9);
  assert.ok(span.end <= 30);
});

// ── templatePatch ──────────────────────────────────────────────────────────

test("templatePatch reaponta tempos e troca ids (determinístico com seed)", () => {
  const tpl: EditorTemplate = {
    layout: "full", camPos: "top", crops: { game: RECT, cam: RECT }, keyframes: [],
    composition: [pane("pane-1")],
    compositionSegments: [],
    textOverlays: [txt({ start: 0, end: 10 })],
    imageOverlays: [img({ start: 0, end: 60 })],
    captionPosition: { x: 0.5, y: 0.88 },
    refDuration: 60,
  };
  const patch = templatePatch(tpl, 30, 7);
  // intro preservado, marca estendida ao novo fim
  assert.equal(patch.textOverlays![0]!.end, 10);
  assert.equal(patch.imageOverlays![0]!.end, 30);
  // ids regenerados (não colidem com os contadores txt-N / img-N do store)
  assert.ok(patch.textOverlays![0]!.id.startsWith("txt-m"));
  assert.ok(patch.imageOverlays![0]!.id.startsWith("img-m"));
  // mesmo seed => mesmo id (determinístico p/ teste)
  assert.equal(templatePatch(tpl, 30, 7).textOverlays![0]!.id, patch.textOverlays![0]!.id);
});

test("templatePatch descarta itens que não cabem no novo clipe", () => {
  const tpl: EditorTemplate = {
    layout: "full", camPos: "top", crops: { game: RECT, cam: RECT }, keyframes: [],
    composition: [],
    compositionSegments: [],
    textOverlays: [txt({ start: 0, end: 5 }), txt({ id: "txt-2", start: 40, end: 50 })],
    imageOverlays: [],
    captionPosition: { x: 0.5, y: 0.88 },
    refDuration: 60,
  };
  const patch = templatePatch(tpl, 30, 1);
  assert.equal(patch.textOverlays!.length, 1); // o que começa em 40 é descartado
  assert.equal(patch.textOverlays![0]!.start, 0);
});

test("templatePatch deixa composition/compositionSegments undefined quando vazios", () => {
  const tpl: EditorTemplate = {
    layout: "full", camPos: "top", crops: { game: RECT, cam: RECT }, keyframes: [],
    composition: [], compositionSegments: [], textOverlays: [], imageOverlays: [],
    captionPosition: { x: 0.5, y: 0.88 }, refDuration: 60,
  };
  const patch = templatePatch(tpl, 30, 1);
  assert.equal(patch.composition, undefined);
  assert.equal(patch.compositionSegments, undefined);
});

test("templatePatch reaponta e preserva os focos dos layouts por tempo", () => {
  const seg: CompositionSegment = { id: "lay-1", start: 0, end: 60, panes: [pane("pane-1"), pane("pane-2")] };
  const tpl: EditorTemplate = {
    layout: "full", camPos: "top", crops: { game: RECT, cam: RECT }, keyframes: [],
    composition: [], compositionSegments: [seg], textOverlays: [], imageOverlays: [],
    captionPosition: { x: 0.5, y: 0.88 }, refDuration: 60,
  };
  const patch = templatePatch(tpl, 40, 1);
  assert.equal(patch.compositionSegments!.length, 1);
  assert.equal(patch.compositionSegments![0]!.end, 40); // ia até o fim => novo fim
  assert.equal(patch.compositionSegments![0]!.panes.length, 2);
  assert.ok(patch.compositionSegments![0]!.id.startsWith("lay-m"));
});
