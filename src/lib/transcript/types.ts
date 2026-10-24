// Formato único de transcrição, venha de legenda do YouTube ou do Whisper.
// Tudo em milissegundos, relativo ao início do vídeo/clip.

export type Word = {
  text: string;
  startMs: number;
  endMs: number;
  /** true quando o tempo da palavra foi estimado (legenda manual sem tempo por palavra). */
  estimated?: boolean;
  /** Troca de falante antes desta palavra (o YouTube marca com ">>"). */
  speakerChange?: boolean;
};

/** Linha curta (~2 s, ~42 caracteres): o que o player mostra sincronizado. */
export type Line = {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
  wordStart: number; // índice da 1ª palavra em `words`
  wordEnd: number; // índice da última palavra (inclusive)
  speakerChange?: boolean; // a linha começa com troca de falante (">>" no YouTube)
};

/** Bloco longo (~25 s, com sobreposição) para mandar a um LLM. */
export type Chunk = { index: number; startMs: number; endMs: number; text: string };

export type TranscriptSource =
  | { platform: 'youtube'; videoId: string }
  | { platform: 'twitch_clip'; slug: string }
  | { platform: 'twitch_vod'; vodId: string; startMs: number; endMs: number }
  | { platform: 'file'; key: string }; // upload próprio ou outra origem

export type TranscriptMethod = 'youtube_asr' | 'youtube_manual' | 'whisper';

export type Transcript = {
  source: TranscriptSource;
  method: TranscriptMethod;
  language: string; // 'pt', 'en'…
  durationMs: number;
  words: Word[];
  lines: Line[];
  chunks: Chunk[];
  createdAt: string;
};

export class TranscriptError extends Error {
  public status: number;
  public code?: string;
  constructor(message: string, status = 502, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Chave estável de cache por origem. */
export function sourceKey(s: TranscriptSource): string {
  switch (s.platform) {
    case 'youtube':
      return `youtube:${s.videoId}`;
    case 'twitch_clip':
      return `twitch_clip:${s.slug}`;
    case 'twitch_vod':
      return `twitch_vod:${s.vodId}:${s.startMs}-${s.endMs}`;
    case 'file':
      return `file:${s.key}`;
  }
}
