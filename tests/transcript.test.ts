import assert from "node:assert/strict";
import test from "node:test";
import { buildChunks, buildLines, toSrt } from "../src/lib/transcript/normalize.ts";
import { parseHighlights } from "../src/lib/transcript/highlights.ts";
import { searchTranscript, selectionToTrim } from "../src/lib/transcript/selection.ts";

const words = Array.from({ length: 140 }, (_, i) => ({ text: i % 17 === 16 ? `fim${i}.` : `palavra${i}`, startMs: i * 400, endMs: i * 400 + 350 }));

test("transcript normaliza json3, linhas, busca e SRT", () => {
  const lines = buildLines(words);
  assert.equal(lines.at(-1)?.wordEnd, words.length - 1);
  assert.ok(buildChunks(words).length >= 2);
  assert.equal(searchTranscript([{ text: "combustível", startMs: 100, endMs: 500 }], "combustivel").length, 1);
  assert.match(toSrt(lines), /^1\n00:00:00,000 --> /);
});

test("seleção respeita limite e parser de highlights encaixa nas palavras", () => {
  const trim = selectionToTrim(words, 0, 100, { maxMs: 30_000 });
  assert.equal(trim.endMs - trim.startMs, 30_000);
  assert.ok(trim.warnings.includes("selecao_longa_cortada"));
  const answer = `{"moments":[{"start":"0:20","end":"0:45","firstWords":"palavra50 palavra51 palavra52","lastWords":"palavra60 palavra61 palavra62","title":"A","score":91},{"start":"0:30","end":"0:50","title":"sobreposto","score":80}]}`;
  const highlights = parseHighlights(answer, words, { minSeconds: 10, maxSeconds: 60 });
  assert.equal(highlights.length, 1);
  assert.equal(highlights[0]?.title, "A");
  assert.equal(highlights[0]?.wordStart, 50);
});
