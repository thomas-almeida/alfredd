import test from "node:test";
import assert from "node:assert/strict";
import { nextPreviewAttempt } from "../src/lib/youtube/preview.ts";

test("prévia do YouTube tenta URL direta, refresh e proxy local", () => {
  const direct = "/api/youtube/source?videoId=abc&audio=0";
  const proxy = "/api/youtube/source?videoId=abc";
  assert.deepEqual(nextPreviewAttempt(direct, proxy, 0), {
    attempt: 1,
    url: `${direct}&refresh=1`,
  });
  assert.deepEqual(nextPreviewAttempt(direct, proxy, 1), { attempt: 2, url: proxy });
  assert.equal(nextPreviewAttempt(direct, proxy, 2), null);
});

test("prévia não cria uma quarta tentativa depois do proxy", () => {
  assert.equal(nextPreviewAttempt("direct", "proxy", 3), null);
});
