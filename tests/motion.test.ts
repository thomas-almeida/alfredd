import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOTION_PRESETS,
  applyMotionPreset,
  camRectFromFaces,
  detectPeaks,
  panRect,
  peakKeyframes,
  rmsEnvelope,
  zoomRect,
} from "../src/lib/editor/motion.ts";
import { cropsAt, defaultState, slotsFor, type Keyframe } from "../src/lib/export/layouts.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const R = { x: 0.2, y: 0.2, w: 0.4, h: 0.6 };
const center = (r: typeof R) => [r.x + r.w / 2, r.y + r.h / 2];
const inside = (r: typeof R) => r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 1 + 1e-9 && r.y + r.h <= 1 + 1e-9;

test("zoomRect mantém centro e proporção", () => {
  const z = zoomRect(R, 2);
  near(z.w, 0.2);
  near(z.h, 0.3);
  assert.deepEqual(center(z).map((v) => +v.toFixed(9)), center(R).map((v) => +v.toFixed(9)));
});

test("zoomRect afastando não passa do frame nem distorce", () => {
  const z = zoomRect(R, 0.1);
  assert.ok(inside(z));
  near(z.w / z.h, R.w / R.h);
});

test("panRect desloca e para na borda", () => {
  near(panRect(R, 0.1).x, 0.3);
  near(panRect(R, 5).x, 0.6);
  near(panRect(R, -5).x, 0);
});

test("MOTION_PRESETS tem ids únicos e durações positivas", () => {
  assert.equal(new Set(MOTION_PRESETS.map((p) => p.id)).size, MOTION_PRESETS.length);
  for (const p of MOTION_PRESETS) assert.ok(p.seconds > 0);
});

test("todos os presets geram keyframes ordenados dentro do frame", () => {
  const s = defaultState(60);
  for (const { id } of MOTION_PRESETS) {
    const kfs = applyMotionPreset(s, id, 2, 5);
    assert.ok(kfs.length >= 2, id);
    assert.equal(kfs[0]!.t, 2);
    assert.equal(kfs.at(-1)!.t, 5);
    for (let i = 1; i < kfs.length; i++) assert.ok(kfs[i]!.t > kfs[i - 1]!.t, id);
    for (const k of kfs) assert.ok(inside(k.crops.game), id);
  }
});

test("zoom_in termina menor, zoom_out começa menor, pan move x", () => {
  const s = defaultState(60);
  const g = s.crops.game;
  const zin = applyMotionPreset(s, "zoom_in", 0, 3);
  assert.ok(zin.at(-1)!.crops.game.w < g.w);
  const zout = applyMotionPreset(s, "zoom_out", 0, 3);
  assert.ok(zout[0]!.crops.game.w < g.w);
  near(zout.at(-1)!.crops.game.w, g.w);
  const l = applyMotionPreset(s, "pan_left", 0, 3).at(-1)!.crops.game.x;
  const r = applyMotionPreset(s, "pan_right", 0, 3).at(-1)!.crops.game.x;
  assert.ok(l < g.x && r > g.x);
});

test("punch_in chega ao zoom rápido e segura", () => {
  const kfs = applyMotionPreset(defaultState(60), "punch_in", 1, 3);
  assert.deepEqual(kfs.map((k) => k.t), [1, 1.15, 3]);
  assert.deepEqual(kfs[1]!.crops.game, kfs[2]!.crops.game);
});

test("preset preserva keyframes fora do trecho e substitui os de dentro", () => {
  const s = defaultState(60);
  const k = (t: number): Keyframe => ({ t, crops: s.crops });
  const kfs = applyMotionPreset({ ...s, keyframes: [k(0.5), k(3), k(9)] }, "zoom_in", 2, 5);
  assert.deepEqual(kfs.map((x) => x.t), [0.5, 2, 5, 9]);
});

test("preset em trecho curto não muda nada", () => {
  const s = { ...defaultState(60), keyframes: [] };
  assert.equal(applyMotionPreset(s, "zoom_in", 1, 1.01), s.keyframes);
});

test("preset no layout cam mexe só na cam", () => {
  const s = { ...defaultState(60), layout: "cam" as const };
  const kfs = applyMotionPreset(s, "zoom_in", 0, 2);
  assert.deepEqual(kfs.at(-1)!.crops.game, s.crops.game);
  assert.ok(kfs.at(-1)!.crops.cam.w < s.crops.cam.w);
});

test("rmsEnvelope calcula RMS por janela", () => {
  const env = rmsEnvelope([1, -1, 1, -1, 0.5, 0.5], 20, 0.2);
  assert.equal(env.length, 2);
  near(env[0]!, 1);
  near(env[1]!, 0.5);
  assert.deepEqual(rmsEnvelope([], 48000), []);
});

const spikes = (n: number, at: Record<number, number>) => Array.from({ length: n }, (_, i) => at[i] ?? 0.1 + (i % 3) * 0.01);

test("detectPeaks acha picos acima do limiar", () => {
  const env = spikes(200, { 40: 1, 120: 0.9 });
  assert.deepEqual(detectPeaks(env, { hop: 0.05, intensity: 0.5 }), [2, 6]);
});

test("detectPeaks respeita minGap (o mais alto vence)", () => {
  const env = spikes(200, { 40: 0.8, 50: 1 });
  assert.deepEqual(detectPeaks(env, { hop: 0.05, intensity: 0.5, minGap: 1 }), [2.5]);
  assert.equal(detectPeaks(env, { hop: 0.05, intensity: 0.5, minGap: 0.2 }).length, 2);
});

test("detectPeaks filtra por within e ignora sinal constante", () => {
  const env = spikes(200, { 40: 1, 120: 0.9 });
  assert.deepEqual(detectPeaks(env, { hop: 0.05, intensity: 0.5, within: [{ start: 5, end: 7 }] }), [6]);
  assert.deepEqual(detectPeaks(new Array(100).fill(0.3), { hop: 0.05, intensity: 1 }), []);
});

test("detectPeaks: mais intensidade nunca dá menos picos", () => {
  const env = Array.from({ length: 400 }, (_, i) => Math.abs(Math.sin(i * 0.37)) * ((i * 7919) % 13) / 13);
  const lo = detectPeaks(env, { hop: 0.05, intensity: 0 }).length;
  const hi = detectPeaks(env, { hop: 0.05, intensity: 1 }).length;
  assert.ok(hi >= lo);
});

test("peakKeyframes gera entrada, zoom, hold e volta", () => {
  const s = defaultState(60);
  const kfs = peakKeyframes(s, [5]);
  assert.deepEqual(kfs.map((k) => +k.t.toFixed(6)), [4.85, 5, 5.6, 6]);
  assert.ok(kfs[1]!.crops.game.w < s.crops.game.w);
  assert.deepEqual(kfs[3]!.crops.game, s.crops.game);
  near(cropsAt({ crops: s.crops, keyframes: kfs }, 10).game.w, s.crops.game.w);
});

test("camRectFromFaces respeita a proporção do slot e usa a mediana", () => {
  const face = { x: 0.05, y: 0.6, w: 0.08, h: 0.14 };
  const r = camRectFromFaces([face, face, { x: 0.8, y: 0.1, w: 0.08, h: 0.14 }])!;
  const slot = slotsFor("cam_game").find((s) => s.key === "cam")!;
  near((r.w * 1920) / (r.h * 1080), slot.dw / slot.dh, 1e-3);
  assert.ok(inside(r));
  assert.ok(r.x < 0.3, "deveria seguir a maioria (canto esquerdo), não o outlier");
  assert.equal(camRectFromFaces([]), null);
});

test("camRectFromFaces clampa rostos gigantes no frame", () => {
  const r = camRectFromFaces([{ x: 0.3, y: 0.2, w: 0.5, h: 0.7 }])!;
  assert.ok(inside(r));
});
