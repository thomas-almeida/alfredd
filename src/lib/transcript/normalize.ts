// Palavras → linhas (player) e blocos (LLM). Mesmas duas granularidades do ytultra:
// linhas de ~2 s / ~42 caracteres e blocos de ~25 s com ~3 s de sobreposição.

import type { Chunk, Line, Transcript, TranscriptMethod, TranscriptSource, Word } from './types.ts';

export type LineOptions = { maxChars?: number; maxMs?: number; gapMs?: number };

const ENDS_SENTENCE = /[.!?…]["')\]]?$/;

export function buildLines(words: Word[], o: LineOptions = {}): Line[] {
  const maxChars = o.maxChars ?? 42;
  const maxMs = o.maxMs ?? 2600;
  const gapMs = o.gapMs ?? 800; // silêncio que força quebra
  const lines: Line[] = [];
  let start = 0;

  const flush = (end: number) => {
    if (end < start) return;
    const ws = words.slice(start, end + 1);
    lines.push({
      index: lines.length,
      startMs: ws[0]!.startMs,
      endMs: ws[ws.length - 1]!.endMs,
      text: ws.map((w) => w.text).join(' '),
      wordStart: start,
      wordEnd: end,
      ...(ws[0]!.speakerChange && { speakerChange: true }),
    });
    start = end + 1;
  };

  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1];
    if (!next) { flush(i); break; }
    const lenWithNext = words.slice(start, i + 2).reduce((n, w) => n + w.text.length + 1, -1);
    const spanWithNext = next.endMs - words[start]!.startMs;
    const breakHere =
      next.speakerChange ||
      next.startMs - words[i]!.endMs >= gapMs ||
      lenWithNext > maxChars ||
      spanWithNext > maxMs ||
      (ENDS_SENTENCE.test(words[i]!.text) && i - start >= 2);
    if (breakHere) flush(i);
  }
  return lines;
}

export type ChunkOptions = { chunkMs?: number; overlapMs?: number };

/** Blocos de duração fixa, alinhados a palavras, com sobreposição para não cortar ideias ao meio. */
export function buildChunks(words: Word[], o: ChunkOptions = {}): Chunk[] {
  const chunkMs = o.chunkMs ?? 25_000;
  const overlapMs = o.overlapMs ?? 3_000;
  const chunks: Chunk[] = [];
  if (!words.length) return chunks;
  let from = words[0]!.startMs;
  const last = words[words.length - 1]!.endMs;

  while (from < last) {
    const to = from + chunkMs;
    const ws = words.filter((w) => w.startMs >= from && w.startMs < to);
    if (ws.length) {
      chunks.push({
        index: chunks.length,
        startMs: ws[0]!.startMs,
        endMs: ws[ws.length - 1]!.endMs,
        text: ws.map((w) => (w.speakerChange ? `— ${w.text}` : w.text)).join(' '),
      });
    }
    from = to - overlapMs;
  }
  return chunks;
}

export function buildTranscript(args: {
  source: TranscriptSource;
  method: TranscriptMethod;
  language: string;
  words: Word[];
  durationMs?: number | null;
  lineOptions?: LineOptions;
  chunkOptions?: ChunkOptions;
}): Transcript {
  const words = args.words;
  return {
    source: args.source,
    method: args.method,
    language: args.language,
    durationMs: args.durationMs ?? (words.at(-1)?.endMs ?? 0),
    words,
    lines: buildLines(words, args.lineOptions),
    chunks: buildChunks(words, args.chunkOptions),
    createdAt: new Date().toISOString(),
  };
}

/** Exporta SRT (útil para baixar ou queimar legenda no Short). */
export function toSrt(lines: Line[], offsetMs = 0): string {
  const ts = (ms: number) => {
    const t = Math.max(ms - offsetMs, 0);
    const h = Math.floor(t / 3.6e6), m = Math.floor((t % 3.6e6) / 6e4), s = Math.floor((t % 6e4) / 1e3), r = t % 1e3;
    const p = (n: number, l = 2) => String(n).padStart(l, '0');
    return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
  };
  return lines
    .filter((l) => l.endMs > offsetMs)
    .map((l, i) => `${i + 1}\n${ts(l.startMs)} --> ${ts(l.endMs)}\n${l.text}\n`)
    .join('\n');
}
