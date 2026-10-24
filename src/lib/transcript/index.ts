// Tudo que roda no navegador está em `./client` (sem Node). Este índice é para o servidor.
import 'server-only';

export * from './types.ts';
export * from './normalize.ts';
export * from './selection.ts';
export * from './highlights.ts';
export { getTranscript, type TranscriptStore, type GetTranscriptOptions } from './get-transcript.ts';
export { supabaseTranscriptStore } from './supabase-store.ts';
export { geminiComplete, openAiCompatibleComplete } from './llm.ts';
export { parseSource, parseYouTubeId } from './sources.ts';
export { getYouTubeCaptionWords, listCaptionTracks, parseJson3, pickTrack } from './youtube-captions.ts';
export { transcribeWithWhisper, transcribeFile, whisperConfigFromEnv } from './whisper.ts';
