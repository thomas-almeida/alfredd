import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
  slotsFor,
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
  assert.equal(defaultState(120).trim.end, MAX_CLIP_SECONDS);
});

test("cropToPixels converte para pixels inteiros", () => {
  assert.deepEqual(cropToPixels({ x: 0.5, y: 0, w: 0.25, h: 1 }, 1920, 1080), {
    sx: 960,
    sy: 0,
    sw: 480,
    sh: 1080,
  });
});
