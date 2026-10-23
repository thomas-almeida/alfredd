import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeClipScore,
  CLIP_SCORE_VERSION,
} from "../src/lib/scoring/clipScore.ts";

test("sem snapshots suficientes e clipe novo → status 'novo'", () => {
  const r = computeClipScore({ snapshots: [], ageHours: 1 });
  assert.equal(r.status, "novo");
  assert.equal(r.score, null);
});

test("sem snapshots suficientes e clipe velho → 'insuficiente'", () => {
  const r = computeClipScore({
    snapshots: [{ viewCount: 10, observedAt: new Date() }],
    ageHours: 10,
  });
  assert.equal(r.status, "insuficiente");
  assert.equal(r.score, null);
});

test("com dois snapshots válidos → score 0..100 e versão correta", () => {
  const now = Date.now();
  const r = computeClipScore({
    snapshots: [
      { viewCount: 100, observedAt: new Date(now - 2 * 3_600_000) },
      { viewCount: 400, observedAt: new Date(now) },
    ],
    ageHours: 2,
    cohortMedianVelocity: 50,
    cohortP90Velocity: 200,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.version, CLIP_SCORE_VERSION);
  assert.ok(r.score !== null && r.score >= 0 && r.score <= 100);
});

test("não gera score quando a janela de tempo é não-positiva", () => {
  const d = new Date();
  const r = computeClipScore({
    snapshots: [
      { viewCount: 100, observedAt: d },
      { viewCount: 200, observedAt: d },
    ],
    ageHours: 3,
  });
  assert.equal(r.status, "insuficiente");
});
