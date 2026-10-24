// Funções puras para o editor de cortes (rodam no navegador e no servidor).
//
//  - wordIndexAt / lineIndexAt: destacar o que está sendo falado no player
//  - searchTranscript: "pular para quando ele fala de combustível"
//  - selectionToTrim: o usuário seleciona um trecho do texto → início/fim do corte,
//    encaixados nas bordas das palavras para nunca cortar fala no meio
//  - expandToSentence: arredonda a seleção para frases inteiras

import type { Line, Word } from './types.ts';

const fold = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Busca binária: índice da palavra falada em `ms` (ou a anterior mais próxima). */
export function wordIndexAt(words: Word[], ms: number): number {
  let lo = 0, hi = words.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid]!.startMs <= ms) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export function lineIndexAt(lines: Line[], ms: number): number {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.startMs <= ms) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export type SearchHit = { wordStart: number; wordEnd: number; startMs: number; endMs: number; snippet: string };

/** Busca por frase, sem acento e sem pontuação, atravessando quebras de linha. */
export function searchTranscript(words: Word[], query: string, o: { contextWords?: number; limit?: number } = {}): SearchHit[] {
  const q = fold(query).split(' ').filter(Boolean);
  if (!q.length) return [];
  const folded = words.map((w) => fold(w.text));
  const ctx = o.contextWords ?? 6;
  const hits: SearchHit[] = [];
  for (let i = 0; i < folded.length && hits.length < (o.limit ?? 50); i++) {
    let ok = true;
    for (let k = 0; k < q.length; k++) {
      const w = folded[i + k];
      // última palavra da busca casa por prefixo ("combust" acha "combustível")
      if (w === undefined || (k === q.length - 1 ? !w.startsWith(q[k]!) : w !== q[k])) { ok = false; break; }
    }
    if (!ok) continue;
    const end = i + q.length - 1;
    hits.push({
      wordStart: i,
      wordEnd: end,
      startMs: words[i]!.startMs,
      endMs: words[end]!.endMs,
      snippet: words.slice(Math.max(0, i - ctx), end + ctx + 1).map((w) => w.text).join(' '),
    });
    i = end;
  }
  return hits;
}

/** Amplia [from, to] até o início e o fim das frases que contêm a seleção. */
export function expandToSentence(words: Word[], from: number, to: number, maxWords = 80): [number, number] {
  const endsSentence = (w?: Word) => !!w && /[.!?…]["')\]]?$/.test(w.text);
  let a = from;
  while (a > 0 && from - a < maxWords && !endsSentence(words[a - 1]) && !words[a]!.speakerChange) a--;
  let b = to;
  while (b < words.length - 1 && b - to < maxWords && !endsSentence(words[b])) b++;
  return [a, b];
}

export type TrimOptions = {
  padBeforeMs?: number; // respiro antes da 1ª palavra
  padAfterMs?: number; // respiro depois da última
  minMs?: number;
  maxMs?: number; // limite do export (90 s no clipador)
  durationMs?: number; // duração da mídia, para não passar do fim
  snapToSentence?: boolean;
};

export type Trim = {
  startMs: number;
  endMs: number;
  wordStart: number;
  wordEnd: number;
  text: string;
  warnings: string[];
};

/**
 * Seleção de palavras → corte. O respiro nunca invade a palavra vizinha:
 * o início fica entre o fim da palavra anterior e o começo da selecionada.
 */
export function selectionToTrim(words: Word[], fromWord: number, toWord: number, o: TrimOptions = {}): Trim {
  if (!words.length) throw new Error('Transcrição vazia');
  let a = Math.max(0, Math.min(fromWord, toWord));
  let b = Math.min(words.length - 1, Math.max(fromWord, toWord));
  if (o.snapToSentence) [a, b] = expandToSentence(words, a, b);

  const padB = o.padBeforeMs ?? 250;
  const padA = o.padAfterMs ?? 400;
  const prevEnd = a > 0 ? words[a - 1]!.endMs : 0;
  const nextStart = b < words.length - 1 ? words[b + 1]!.startMs : (o.durationMs ?? Infinity);

  let startMs = Math.max(words[a]!.startMs - padB, prevEnd, 0);
  let endMs = Math.min(words[b]!.endMs + padA, nextStart, o.durationMs ?? Infinity);
  // Se o vizinho está colado, fica no meio do intervalo entre as palavras.
  if (startMs > words[a]!.startMs) startMs = words[a]!.startMs;
  if (endMs < words[b]!.endMs) endMs = words[b]!.endMs;

  const warnings: string[] = [];
  const minMs = o.minMs ?? 0;
  if (endMs - startMs < minMs) {
    const missing = minMs - (endMs - startMs);
    startMs = Math.max(0, startMs - missing / 2);
    endMs = Math.min(o.durationMs ?? Infinity, endMs + missing / 2);
    warnings.push('selecao_curta_ampliada');
  }
  if (o.maxMs && endMs - startMs > o.maxMs) {
    endMs = startMs + o.maxMs;
    b = Math.max(a, wordIndexAt(words, endMs - 1));
    warnings.push('selecao_longa_cortada');
  }
  if (words.slice(a, b + 1).some((w) => w.estimated)) warnings.push('tempos_estimados');

  return {
    startMs: Math.round(startMs),
    endMs: Math.round(endMs),
    wordStart: a,
    wordEnd: b,
    text: words.slice(a, b + 1).map((w) => w.text).join(' '),
    warnings,
  };
}

/** O inverso: corte (vindo do trim manual) → palavras e texto dentro dele. */
export function trimToText(words: Word[], startMs: number, endMs: number): { wordStart: number; wordEnd: number; text: string } {
  const inside = words.map((w, i) => [w, i] as const).filter(([w]) => w.startMs >= startMs && w.endMs <= endMs);
  if (!inside.length) return { wordStart: -1, wordEnd: -1, text: '' };
  return { wordStart: inside[0]![1], wordEnd: inside.at(-1)![1], text: inside.map(([w]) => w.text).join(' ') };
}

/** Palavras do corte com tempo relativo ao início do corte (para legenda queimada no Short). */
export function wordsForClip(words: Word[], startMs: number, endMs: number): Word[] {
  return words
    .filter((w) => w.endMs > startMs && w.startMs < endMs)
    .map((w) => ({ ...w, startMs: Math.max(0, w.startMs - startMs), endMs: Math.min(endMs, w.endMs) - startMs }));
}
