// Transcrição por IA (Whisper) com tempo por palavra.
// Usado quando o YouTube não tem legenda ou bloqueia, e SEMPRE para a Twitch.
//
// Qualquer API compatível com /audio/transcriptions da OpenAI:
//   Groq   → whisper-large-v3-turbo (padrão: barato e muito rápido)
//   OpenAI → whisper-1 (o único modelo da OpenAI com tempo por palavra)
// Configuração por env: TRANSCRIBE_PROVIDER, TRANSCRIBE_API_KEY, TRANSCRIBE_MODEL, TRANSCRIBE_BASE_URL.
//
// Só roda em Node (ffmpeg via spawn). Nas rotas: export const runtime = 'nodejs'.

import 'server-only';

import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TranscriptError, type Word } from './types.ts';

const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe';
// Mantém margem abaixo do limite de upload do Groq no plano gratuito.
const MAX_TRANSCRIBE_FILE_BYTES = 20 * 1024 * 1024;

const PROVIDERS = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo', keyEnv: 'GROQ_API_KEY' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'whisper-1', keyEnv: 'OPENAI_API_KEY' },
} as const;

export type WhisperConfig = { baseUrl: string; model: string; apiKey: string };

export function whisperConfigFromEnv(): WhisperConfig {
  const p = (process.env.TRANSCRIBE_PROVIDER ?? 'groq') as keyof typeof PROVIDERS;
  const preset = PROVIDERS[p] ?? PROVIDERS.groq;
  const apiKey = process.env.TRANSCRIBE_API_KEY ?? process.env[preset.keyEnv];
  if (!apiKey) throw new TranscriptError(`Defina TRANSCRIBE_API_KEY (ou ${preset.keyEnv})`, 500, 'no_whisper_key');
  return {
    baseUrl: process.env.TRANSCRIBE_BASE_URL ?? preset.baseUrl,
    model: process.env.TRANSCRIBE_MODEL ?? preset.model,
    apiKey,
  };
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => reject(new TranscriptError(`${cmd} não encontrado: ${e.message}`, 500, 'ffmpeg_missing')));
    p.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new TranscriptError(`${cmd} saiu com ${code}: ${err.slice(-300)}`, 500, 'ffmpeg_failed')),
    );
  });
}

export async function probeDurationMs(file: string): Promise<number> {
  const out = await run(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Math.round(parseFloat(out) * 1000);
}

/**
 * Extrai áudio mono 16 kHz em MP3 32 kbps (≈14 MB/hora) e divide em partes de `partSeconds`.
 * `input` pode ser arquivo local ou URL (ex.: MP4 assinado de clip da Twitch).
 */
export async function extractAudioParts(
  input: string,
  o: { startMs?: number; endMs?: number; partSeconds?: number } = {},
): Promise<{ dir: string; parts: { file: string; offsetMs: number; durationMs: number }[] }> {
  const dir = await mkdtemp(join(tmpdir(), 'asr-'));
  const part = o.partSeconds ?? 300; // 5 min: mantém cada arquivo bem abaixo do limite de upload
  const range = [
    ...(o.startMs ? ['-ss', (o.startMs / 1000).toFixed(3)] : []),
    ...(o.endMs ? ['-to', (o.endMs / 1000).toFixed(3)] : []),
  ];
  await run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...range, '-i', input,
    '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '32k',
    '-f', 'segment', '-segment_time', String(part), '-reset_timestamps', '1',
    join(dir, 'part%03d.mp3'),
  ]);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mp3')).sort();
  const parts: { file: string; offsetMs: number; durationMs: number }[] = [];
  let offset = o.startMs ?? 0; // tempos finais ficam relativos ao vídeo de origem
  for (const f of files) {
    const file = join(dir, f);
    const durationMs = await probeDurationMs(file).catch(() => 0);
    if (durationMs < 200) continue; // parte vazia/corrompida (mídia ilegível ou sem áudio)
    parts.push({ file, offsetMs: offset, durationMs });
    offset += durationMs;
  }
  if (!parts.length) {
    await rm(dir, { recursive: true, force: true });
    throw new TranscriptError('Não foi possível extrair áudio da mídia (sem áudio, link expirado ou servidor sem Range)', 422, 'media_unreadable');
  }
  return { dir, parts };
}

type VerboseJson = {
  language?: string;
  duration?: number;
  words?: { word: string; start: number; end: number }[];
  segments?: { start: number; end: number; text: string; no_speech_prob?: number; avg_logprob?: number }[];
};

/** Envia um arquivo de áudio e devolve palavras com tempo (somando `offsetMs`). */
export async function transcribeFile(
  file: string,
  offsetMs: number,
  o: { config?: WhisperConfig; language?: string; prompt?: string } = {},
): Promise<{ words: Word[]; language?: string }> {
  const size = (await stat(file)).size;
  if (size >= MAX_TRANSCRIBE_FILE_BYTES) {
    throw new TranscriptError(
      'O arquivo de áudio excede o limite seguro de 20 MB e não será enviado para transcrição.',
      413,
      'transcribe_file_too_large',
    );
  }
  const cfg = o.config ?? whisperConfigFromEnv();
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(await readFile(file))], { type: 'audio/mpeg' }), 'audio.mp3');
  form.append('model', cfg.model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('timestamp_granularities[]', 'segment');
  form.append('temperature', '0');
  if (o.language) form.append('language', o.language);
  // Prompt com nomes próprios melhora muito a grafia (ex.: "GTA VI, Rockstar, Cinna").
  if (o.prompt) form.append('prompt', o.prompt.slice(0, 800));

  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new TranscriptError(`Whisper HTTP ${res.status}: ${body.slice(0, 300)}`, res.status === 429 ? 429 : 502, 'whisper_http');
  }
  const j = (await res.json()) as VerboseJson;

  // Trechos que o modelo marcou como "provavelmente silêncio" geram alucinação ("Obrigado por assistir").
  const silent = (j.segments ?? []).filter((s) => (s.no_speech_prob ?? 0) > 0.8 && (s.avg_logprob ?? 0) < -1);
  const inSilence = (t: number) => silent.some((s) => t >= s.start && t < s.end);

  let words: Word[];
  if (j.words?.length) {
    words = j.words
      .filter((w) => w.word.trim() && !inSilence(w.start))
      .map((w) => ({ text: w.word.trim(), startMs: offsetMs + Math.round(w.start * 1000), endMs: offsetMs + Math.round(w.end * 1000) }));
  } else {
    // Provedor sem tempo por palavra: interpola dentro de cada segmento.
    words = [];
    for (const s of j.segments ?? []) {
      if (inSilence(s.start)) continue;
      const toks = s.text.trim().split(/\s+/).filter(Boolean);
      const total = toks.reduce((n, t) => n + t.length + 1, 0) || 1;
      let acc = 0;
      for (const t of toks) {
        const st = s.start + ((s.end - s.start) * acc) / total;
        acc += t.length + 1;
        const en = s.start + ((s.end - s.start) * acc) / total;
        words.push({ text: t, startMs: offsetMs + Math.round(st * 1000), endMs: offsetMs + Math.round(en * 1000), estimated: true });
      }
    }
  }
  return { words, language: j.language };
}

const ISO: Record<string, string> = { portuguese: 'pt', english: 'en', spanish: 'es' };

/**
 * Áudio de qualquer origem → palavras. Partes são enviadas com concorrência limitada.
 */
export async function transcribeWithWhisper(
  input: string,
  o: { startMs?: number; endMs?: number; language?: string; prompt?: string; config?: WhisperConfig; concurrency?: number; partSeconds?: number } = {},
): Promise<{ words: Word[]; language: string; durationMs: number }> {
  const { dir, parts } = await extractAudioParts(input, o);
  try {
    if (!parts.length) throw new TranscriptError('Sem áudio para transcrever', 422, 'no_audio');
    const results: { words: Word[]; language?: string }[] = new Array(parts.length);
    let next = 0;
    const worker = async () => {
      while (next < parts.length) {
        const i = next++;
        const p = parts[i]!;
        results[i] = await transcribeFile(p.file, p.offsetMs, o);
      }
    };
    await Promise.all(Array.from({ length: Math.min(o.concurrency ?? 3, parts.length) }, worker));
    const lang = results.find((r) => r.language)?.language?.toLowerCase() ?? o.language ?? 'pt';
    return {
      words: results.flatMap((r) => r.words),
      language: ISO[lang] ?? lang.slice(0, 2),
      durationMs: parts.reduce((n, p) => n + p.durationMs, 0),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
