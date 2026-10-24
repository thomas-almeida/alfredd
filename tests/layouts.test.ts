import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inSegments,
  framingAt,
  outputSegments,
  intersectSegments,
  normalizeAudio,
  CAM_H,
  MAX_CLIP_SECONDS,
  OUT_H,
  OUT_W,
  centeredCrop,
  clampRect,
  clampTrim,
  cropToPixels,
  defaultState,
  lockAspect,
  nextPlayable,
  normalizeSegments,
  removeSegment,
  segmentIndexAt,
  segmentsTotal,
  splitAt,
  slotsFor,
  cropsAt,
  upsertKeyframe,
  removeKeyframeAt,
  fitKeyframes,
  keyframeIndexAt,
  type Keyframe,
} from "../src/lib/export/layouts.ts";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);

test("slotsFor cobre o frame 1080×1920", () => {
  const [full] = slotsFor("full");
  assert.deepEqual(full, { key: "game", dx: 0, dy: 0, dw: OUT_W, dh: OUT_H });
  const cg = slotsFor("cam_game");
  assert.equal(cg.reduce((s, x) => s + x.dh, 0), OUT_H);
  assert.equal(cg[0]?.dh, CAM_H);
});

test("centeredCrop respeita a proporção 9:16 numa fonte 16:9", () => {
  const r = centeredCrop(1920, 1080, OUT_W, OUT_H);
  near(r.h, 1);
  near((r.w * 1920) / (r.h * 1080), OUT_W / OUT_H);
  near(r.x, (1 - r.w) / 2);
});

test("clampRect mantém dentro de [0,1]", () => {
  const r = clampRect({ x: 0.9, y: -0.2, w: 0.3, h: 0.5 });
  near(r.x, 0.7);
  near(r.y, 0);
});

test("lockAspect ajusta a altura à proporção do slot", () => {
  const r = lockAspect({ x: 0, y: 0, w: 0.3, h: 0.1 }, 1920, 1080, OUT_W, CAM_H);
  near((r.w * 1920) / (r.h * 1080), OUT_W / CAM_H);
});

test("clampTrim limita a 90 s e ordena", () => {
  assert.deepEqual(clampTrim({ start: 0, end: 200 }, 200), { start: 0, end: MAX_CLIP_SECONDS });
  const t = clampTrim({ start: 10, end: 5 }, 30);
  assert.ok(t.end > t.start);
  assert.equal(defaultState(120).segments[0]!.end, MAX_CLIP_SECONDS);
});

test("cropToPixels converte para pixels inteiros", () => {
  assert.deepEqual(cropToPixels({ x: 0.5, y: 0, w: 0.25, h: 1 }, 1920, 1080), {
    sx: 960,
    sy: 0,
    sw: 480,
    sh: 1080,
  });
});

test("normalizeSegments ordena, funde e limita a 90 s", () => {
  const segs = normalizeSegments(
    [
      { start: 50, end: 60 },
      { start: 0, end: 10 },
      { start: 5, end: 20 },
      { start: 30, end: 30.05 },
    ],
    100,
  );
  assert.deepEqual(segs, [
    { start: 0, end: 20 },
    { start: 50, end: 60 },
  ]);
  const big = normalizeSegments([{ start: 0, end: 60 }, { start: 100, end: 160 }], 200);
  near(segmentsTotal(big), MAX_CLIP_SECONDS);
  assert.equal(normalizeSegments([], 30).length, 1);
});

test("splitAt, removeSegment e nextPlayable", () => {
  const split = splitAt([{ start: 0, end: 10 }], 4);
  assert.deepEqual(split, [
    { start: 0, end: 4 },
    { start: 4, end: 10 },
  ]);
  assert.equal(splitAt(split, 4.05).length, 2);
  assert.equal(segmentIndexAt(split, 5), 1);
  assert.equal(removeSegment(split, 0).length, 1);
  assert.equal(removeSegment([{ start: 0, end: 1 }], 0).length, 1);
  const gaps = [
    { start: 2, end: 4 },
    { start: 6, end: 8 },
  ];
  assert.equal(nextPlayable(gaps, 0), 2);
  assert.equal(nextPlayable(gaps, 3), 3);
  assert.equal(nextPlayable(gaps, 5), 6);
  assert.equal(nextPlayable(gaps, 9), null);
});

test("intersectSegments cruza trechos de vídeo e áudio", () => {
  const v = [{ start: 0, end: 5 }, { start: 8, end: 12 }];
  const a = [{ start: 2, end: 9 }, { start: 11, end: 20 }];
  assert.deepEqual(intersectSegments(v, a), [
    { start: 2, end: 5 },
    { start: 8, end: 9 },
    { start: 11, end: 12 },
  ]);
  assert.deepEqual(intersectSegments(v, []), []);
});

test("inSegments respeita início inclusivo e fim exclusivo", () => {
  const s = [{ start: 1, end: 2 }];
  assert.equal(inSegments(s, 1), true);
  assert.equal(inSegments(s, 2), false);
  assert.equal(inSegments([], 1), false);
});

test("normalizeAudio ordena, funde e limita à duração", () => {
  assert.deepEqual(
    normalizeAudio([{ start: 5, end: 200 }, { start: 0, end: 3 }, { start: 2, end: 6 }, { start: 7, end: 7.05 }], 100),
    [{ start: 0, end: 100 }],
  );
});

test("framingAt: sem faixas é tela cheia", () => {
  const s = defaultState(60);
  assert.equal(framingAt(s, 5).layout, "full");
});

test("framingAt: faixa de câmera vence; fora dela volta à tela cheia", () => {
  const s = defaultState(60);
  const tr = { ...s, id: "a", layout: "cam_game" as const, segments: [{ start: 2, end: 4 }] };
  s.tracks = [tr];
  assert.equal(framingAt(s, 3), tr);
  assert.equal(framingAt(s, 4).layout, "full");
});

test("framingAt: câmera sem vídeo principal fica só a cam centralizada", () => {
  const s = defaultState(60);
  s.segments = [{ start: 0, end: 5 }];
  s.tracks = [{ ...s, id: "a", layout: "cam_game", segments: [{ start: 4, end: 8 }] }];
  assert.equal(framingAt(s, 6).layout, "cam");
  const [slot] = slotsFor("cam");
  assert.equal(slot!.key, "cam");
  assert.equal(slot!.dy + slot!.dh / 2, 960);
});

test("framingAt: faixas sobrepostas, a mais alta vence", () => {
  const s = defaultState(60);
  const a = { ...s, id: "a", segments: [{ start: 0, end: 10 }] };
  const b = { ...s, id: "b", camPos: "bottom" as const, segments: [{ start: 5, end: 6 }] };
  s.tracks = [a, b];
  assert.equal(framingAt(s, 5.5), b);
  assert.equal(framingAt(s, 7), a);
});

test("outputSegments: une vídeo principal e câmera", () => {
  const s = defaultState(60);
  s.segments = [{ start: 0, end: 5 }];
  s.tracks = [{ ...s, id: "a", segments: [{ start: 4, end: 8 }, { start: 20, end: 22 }] }];
  assert.deepEqual(outputSegments(s), [{ start: 0, end: 8 }, { start: 20, end: 22 }]);
});

// ---------- Keyframes de crop ----------

const A = { x: 0, y: 0, w: 0.2, h: 0.4 };
const B = { x: 0.6, y: 0.4, w: 0.2, h: 0.4 };
const kf = (t: number, game = A): Keyframe => ({ t, crops: { game, cam: game } });
const ab = [kf(2, A), kf(4, B)];

test("cropsAt: sem keyframes devolve exatamente f.crops (mesma referência)", () => {
  const s = defaultState(60);
  assert.equal(cropsAt(s, 3), s.crops, "sem keyframes não pode criar objeto novo (quebra memo/identidade)");
  assert.equal(cropsAt({ ...s, keyframes: [] }, 3), s.crops, "lista vazia deve se comportar como sem keyframes");
});

test("cropsAt: antes do primeiro e depois do último keyframe fica parado no extremo", () => {
  const f = { crops: defaultState(60).crops, keyframes: ab };
  assert.deepEqual(cropsAt(f, 0).game, A, "antes do 1º keyframe deveria usar o 1º");
  assert.deepEqual(cropsAt(f, 99).game, B, "depois do último keyframe deveria usar o último");
  assert.deepEqual(cropsAt(f, 2).game, A, "exatamente no keyframe deveria ser o próprio crop");
  assert.deepEqual(cropsAt(f, 4).game, B, "exatamente no último keyframe deveria ser o próprio crop");
});

test("cropsAt: no meio interpola com ease simétrica e preserva o tamanho", () => {
  const f = { crops: defaultState(60).crops, keyframes: ab };
  const mid = cropsAt(f, 3).game;
  near(mid.x, 0.3);
  near(mid.y, 0.2);
  near(mid.w, 0.2);
  near(mid.h, 0.4);
  const q = cropsAt(f, 2.5).game.x;
  assert.ok(q > 0 && q < 0.15, `com ease-in, a 1/4 do caminho x deveria estar abaixo de 0.15 (linear), veio ${q}`);
  for (let t = 2; t <= 4; t += 0.1) {
    const r = cropsAt(f, t).game;
    assert.ok(r.x >= 0 && r.x + r.w <= 1 + 1e-9 && r.y >= 0 && r.y + r.h <= 1 + 1e-9, `crop saiu de [0,1] em t=${t}`);
  }
});

test("upsertKeyframe: insere em ordem, substitui dentro de EPS e não muta", () => {
  const base = [kf(1), kf(5)];
  const ins = upsertKeyframe(base, 3, kf(3, B).crops);
  assert.deepEqual(ins.map((k) => k.t), [1, 3, 5], "keyframe deveria entrar ordenado por t");
  assert.equal(base.length, 2, "o array original não pode ser mutado");
  const rep = upsertKeyframe(ins, 3.01, kf(3.01, A).crops);
  assert.equal(rep.length, 3, "t a menos de 1 frame deveria substituir, não duplicar");
  assert.deepEqual(rep[1]!.crops.game, A);
});

test("removeKeyframeAt e keyframeIndexAt", () => {
  assert.equal(keyframeIndexAt(ab, 4.01), 1, "deveria achar o keyframe dentro da tolerância");
  assert.equal(keyframeIndexAt(ab, 3), -1);
  assert.equal(removeKeyframeAt(ab, 3), ab, "sem keyframe em t deveria devolver o mesmo array");
  assert.deepEqual(removeKeyframeAt(ab, 2).map((k) => k.t), [4]);
});

test("fitKeyframes: descarta t inválido, ordena e aceita undefined", () => {
  assert.deepEqual(fitKeyframes(undefined, "full"), []);
  const out = fitKeyframes([kf(4), kf(NaN), kf(1)], "full");
  assert.deepEqual(out.map((k) => k.t), [1, 4], "NaN deveria sumir e o resto ficar ordenado");
});

test("framingAt: keyframes da faixa interpolam; sem keyframes mantém identidade", () => {
  const s = defaultState(60);
  const tr = { ...s, id: "a", layout: "cam_game" as const, segments: [{ start: 2, end: 4 }], keyframes: ab };
  s.tracks = [tr];
  const f = framingAt(s, 3);
  assert.equal(f.layout, "cam_game");
  near(f.crops.game.x, 0.3);
  s.tracks = [{ ...tr, keyframes: undefined }];
  assert.equal(framingAt(s, 3), s.tracks[0], "regressão: sem keyframes framingAt deve devolver a própria faixa");
});

test("framingAt: vídeo principal com keyframes interpola em tela cheia", () => {
  const s = { ...defaultState(60), keyframes: ab };
  near(framingAt(s, 3).crops.game.x, 0.3);
});

test("framingAt: cam fora do vídeo principal também usa crops interpolados", () => {
  const s = defaultState(60);
  s.segments = [{ start: 0, end: 1 }];
  s.tracks = [{ ...s, id: "a", layout: "cam_game", segments: [{ start: 2, end: 4 }], keyframes: ab }];
  const f = framingAt(s, 3);
  assert.equal(f.layout, "cam");
  near(f.crops.cam.x, 0.3);
});
