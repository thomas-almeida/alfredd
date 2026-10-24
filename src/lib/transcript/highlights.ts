// Sugestão de momentos para cortar, a partir da transcrição.
// Agnóstico de provedor: você passa `complete(prompt) => Promise<string>` (OpenRouter, OpenAI, Groq…).
//
// Fluxo: blocos de 25 s → prompt → JSON com momentos → validação → encaixe nas palavras
// (selectionToTrim) → ordenação por score. Sinais extras (picos de chat da Twitch,
// picos de áudio) entram no prompt para a IA pesar.

import { selectionToTrim, wordIndexAt, type Trim } from './selection.ts';
import type { Chunk, Transcript, Word } from './types.ts';

export type Signal = { atMs: number; label: string; intensity?: number }; // ex.: pico de chat ×4.2

export type Highlight = Trim & {
  title: string;
  hook: string;
  reason: string;
  score: number; // 0–100
};

export type HighlightOptions = {
  count?: number; // quantos momentos (padrão 5)
  minSeconds?: number; // padrão 15
  maxSeconds?: number; // padrão 60 (o export aceita 90)
  context?: string; // título do vídeo, canal, jogo — ajuda muito
  signals?: Signal[];
  maxPromptChars?: number; // por janela; transcrições longas são processadas em janelas
};

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m)) + `:${String(r).padStart(2, '0')}`;
};

/** "1:02:03", "02:03", "123", "123.5" → ms */
export function parseTimestamp(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v * 1000);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 1000);
  const p = t.split(':').map(Number);
  if (p.some((n) => !Number.isFinite(n)) || p.length < 2 || p.length > 3) return null;
  const [h = 0, m = 0, s = 0] = p.length === 3 ? p : [0, p[0], p[1]];
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

export function buildHighlightPrompt(chunks: Chunk[], o: HighlightOptions = {}): string {
  const count = o.count ?? 5;
  const minS = o.minSeconds ?? 15;
  const maxS = o.maxSeconds ?? 60;
  const first = chunks[0]?.startMs ?? 0;
  const last = chunks.at(-1)?.endMs ?? 0;
  const sigs = (o.signals ?? [])
    .filter((s) => s.atMs >= first && s.atMs <= last)
    .map((s) => `- ${mmss(s.atMs)}: ${s.label}${s.intensity ? ` (intensidade ${s.intensity})` : ''}`);

  return [
    'Você é editor de cortes virais para TikTok, Reels e YouTube Shorts.',
    `Encontre os ${count} melhores momentos para virar cortes verticais de ${minS} a ${maxS} segundos.`,
    'Um bom corte: começa com um gancho forte nos primeiros 3 segundos, tem uma ideia completa',
    '(começo, meio e fim), e tem emoção, opinião polêmica, revelação, humor ou reação.',
    'Não comece no meio de uma frase e não termine antes da conclusão.',
    o.context ? `\nContexto: ${o.context}` : '',
    sigs.length ? `\nSinais de audiência (pese a favor destes trechos):\n${sigs.join('\n')}` : '',
    '\nTranscrição em blocos [início–fim]. Blocos vizinhos se sobrepõem alguns segundos.',
    '"—" marca troca de falante.\n',
    ...chunks.map((c) => `[${mmss(c.startMs)}–${mmss(c.endMs)}] ${c.text}`),
    '\nResponda SOMENTE com JSON, sem texto antes ou depois, neste formato:',
    '{"moments":[{"start":"m:ss","end":"m:ss","firstWords":"3 a 6 primeiras palavras do corte",',
    '"lastWords":"3 a 6 últimas palavras","title":"título curto para o Short","hook":"frase de gancho",',
    '"reason":"por que funciona","score":0-100}]}',
    'Use tempos dentro da transcrição. Momentos não podem se sobrepor.',
  ]
    .filter(Boolean)
    .join('\n');
}

type RawMoment = {
  start?: unknown; end?: unknown; firstWords?: unknown; lastWords?: unknown;
  title?: unknown; hook?: unknown; reason?: unknown; score?: unknown;
};

function extractJson(text: string): { moments?: RawMoment[] } | RawMoment[] | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  for (const [open, close] of [['{', '}'], ['[', ']']] as const) {
    const a = cleaned.indexOf(open), b = cleaned.lastIndexOf(close);
    if (a >= 0 && b > a) {
      try { return JSON.parse(cleaned.slice(a, b + 1)); } catch { /* tenta o próximo formato */ }
    }
  }
  return null;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();

/** Procura `phrase` perto de `aroundMs` (±windowMs) e devolve o índice da 1ª ou última palavra. */
function locatePhrase(words: Word[], phrase: string, aroundMs: number, edge: 'first' | 'last', windowMs = 8000): number | null {
  const q = fold(phrase).split(/\s+/).filter(Boolean).slice(edge === 'first' ? 0 : -4);
  if (q.length < 2) return null;
  const lo = Math.max(0, wordIndexAt(words, aroundMs - windowMs));
  const hi = Math.min(words.length - 1, wordIndexAt(words, aroundMs + windowMs) + q.length);
  let best: { i: number; d: number } | null = null;
  for (let i = lo; i <= hi - q.length + 1; i++) {
    let ok = true;
    for (let k = 0; k < q.length && ok; k++) ok = fold(words[i + k]?.text ?? '') === q[k];
    if (!ok) continue;
    const idx = edge === 'first' ? i : i + q.length - 1;
    const d = Math.abs(words[idx]!.startMs - aroundMs);
    if (!best || d < best.d) best = { i: idx, d };
  }
  return best?.i ?? null;
}

/** Valida a resposta do LLM e encaixa cada momento nas palavras reais. */
export function parseHighlights(text: string, words: Word[], o: HighlightOptions & { durationMs?: number } = {}): Highlight[] {
  const json = extractJson(text);
  const raw = Array.isArray(json) ? json : json?.moments ?? [];
  const minMs = (o.minSeconds ?? 15) * 1000;
  const maxMs = (o.maxSeconds ?? 60) * 1000;
  const out: Highlight[] = [];

  for (const m of raw) {
    const s = parseTimestamp(m.start), e = parseTimestamp(m.end);
    if (s === null || e === null || e <= s) continue;
    let a = typeof m.firstWords === 'string' ? locatePhrase(words, m.firstWords, s, 'first') : null;
    let b = typeof m.lastWords === 'string' ? locatePhrase(words, m.lastWords, e, 'last') : null;
    a ??= Math.max(0, wordIndexAt(words, s));
    b ??= Math.max(a, wordIndexAt(words, e));
    if (b < a) continue;

    const trim = selectionToTrim(words, a, b, { minMs, maxMs, durationMs: o.durationMs });
    // descarta sobreposição com um momento já aceito
    if (out.some((h) => trim.startMs < h.endMs && h.startMs < trim.endMs)) continue;
    out.push({
      ...trim,
      title: String(m.title ?? '').slice(0, 100),
      hook: String(m.hook ?? '').slice(0, 200),
      reason: String(m.reason ?? '').slice(0, 300),
      score: Math.max(0, Math.min(100, Number(m.score) || 0)),
    });
  }
  return out.sort((x, y) => y.score - x.score);
}

/**
 * Orquestra: divide transcrições longas em janelas que cabem no prompt,
 * pede momentos para cada janela e devolve os melhores no total.
 */
export async function suggestHighlights(
  t: Transcript,
  complete: (prompt: string) => Promise<string>,
  o: HighlightOptions = {},
): Promise<Highlight[]> {
  const maxChars = o.maxPromptChars ?? 60_000;
  const windows: Chunk[][] = [];
  let cur: Chunk[] = [];
  let size = 0;
  for (const c of t.chunks) {
    if (size + c.text.length > maxChars && cur.length) { windows.push(cur); cur = []; size = 0; }
    cur.push(c);
    size += c.text.length + 16;
  }
  if (cur.length) windows.push(cur);

  const count = o.count ?? 5;
  const all: Highlight[] = [];
  for (const w of windows) {
    const perWindow = windows.length > 1 ? Math.max(2, Math.ceil(count / windows.length) + 1) : count;
    const answer = await complete(buildHighlightPrompt(w, { ...o, count: perWindow }));
    for (const h of parseHighlights(answer, t.words, { ...o, durationMs: t.durationMs })) {
      if (!all.some((x) => h.startMs < x.endMs && x.startMs < h.endMs)) all.push(h);
    }
  }
  return all.sort((a, b) => b.score - a.score).slice(0, count);
}
