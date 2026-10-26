// Orquestrador: origem → transcrição, com cache.
//
//   YouTube     → legenda do YouTube (grátis, ~1 s) → se falhar: yt-dlp + Whisper
//   Twitch clip → Whisper (clips não têm legenda)
//   Twitch VOD  → Whisper só na janela pedida
//   Arquivo     → Whisper

import 'server-only';

import { buildTranscript } from './normalize.ts';
import { audioInputFor, youtubeTranscriptFromWorker } from './sources.ts';
import { sourceKey, TranscriptError, type Transcript, type TranscriptSource } from './types.ts';
import { transcribeWithWhisper, type WhisperConfig } from './whisper.ts';
import { getYouTubeCaptionWords } from './youtube-captions.ts';

export interface TranscriptStore {
  get(key: string): Promise<Transcript | null>;
  set(key: string, t: Transcript): Promise<void>;
}

export type GetTranscriptOptions = {
  store?: TranscriptStore;
  force?: boolean; // ignora o cache
  languages?: string[]; // preferência de legenda no YouTube (padrão pt)
  /** 'auto' = legenda e Whisper como plano B; 'captions' = só legenda; 'whisper' = só IA */
  youtubeMode?: 'auto' | 'captions' | 'whisper';
  /** Nomes próprios para o Whisper acertar a grafia (ex.: "GTA VI, Rockstar, Cinna"). */
  vocabulary?: string;
  whisper?: WhisperConfig;
  onProgress?: (step: string) => void;
};

export async function getTranscript(source: TranscriptSource, o: GetTranscriptOptions = {}): Promise<Transcript> {
  const key = sourceKey(source);
  if (o.store && !o.force) {
    const hit = await o.store.get(key);
    if (hit) return hit;
  }

  let t: Transcript | null = null;
  const failures: string[] = [];

  if (source.platform === 'youtube' && o.youtubeMode !== 'whisper') {
    try {
      o.onProgress?.('youtube_captions');
      const c = await getYouTubeCaptionWords(source.videoId, { languages: o.languages });
      t = buildTranscript({
        source,
        method: c.isAsr ? 'youtube_asr' : 'youtube_manual',
        language: c.language,
        words: c.words,
        durationMs: c.durationMs,
      });
    } catch (e) {
      failures.push((e as Error).message);
      if (o.youtubeMode === 'captions') throw e;
    }
  }

  if (!t) {
    o.onProgress?.('whisper');
    if (source.platform === 'youtube') {
      try {
        t = await youtubeTranscriptFromWorker(source.videoId, o.vocabulary);
      } catch (e) {
        failures.push((e as Error).message);
      }
    }
  }

  if (!t) {
    o.onProgress?.('whisper_local');
    const a = await audioInputFor(source);
    const prompt = [o.vocabulary, a.hint].filter(Boolean).join(' ');
    const w = await transcribeWithWhisper(a.input, {
      startMs: a.startMs,
      endMs: a.endMs,
      language: o.languages?.[0]?.split('-')[0] ?? 'pt',
      prompt: prompt || undefined,
      config: o.whisper,
    });
    if (!w.words.length) {
      throw new TranscriptError(`Nada foi transcrito${failures.length ? ` (${failures.join(' | ')})` : ''}`, 422, 'empty');
    }
    t = buildTranscript({ source, method: 'whisper', language: w.language, words: w.words, durationMs: w.durationMs + (a.startMs ?? 0) });
  }

  if (o.store) await o.store.set(key, t);
  return t;
}
