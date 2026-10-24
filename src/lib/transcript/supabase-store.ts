// Cache de transcrições no Supabase (tabela `transcripts`, ver migration).
// Recebe o client já criado (service role no servidor), sem importar o pacote aqui.

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import type { TranscriptStore } from './get-transcript.ts';
import type { Transcript } from './types.ts';

export function supabaseTranscriptStore(supabase: SupabaseClient<Database>, o: { indexLines?: boolean } = {}): TranscriptStore {
  return {
    async get(key) {
      const { data, error } = await supabase.from('transcripts').select('*').eq('source_key', key).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // jsonb volta como Json; o formato é o que gravamos em set()
      return {
        source: data.source as unknown as Transcript['source'],
        method: data.method as Transcript['method'],
        language: data.language,
        durationMs: data.duration_ms,
        words: data.words as unknown as Transcript['words'],
        lines: data.lines as unknown as Transcript['lines'],
        chunks: data.chunks as unknown as Transcript['chunks'],
        createdAt: data.created_at,
      } satisfies Transcript;
    },
    async set(key, t) {
      const { error } = await supabase.from('transcripts').upsert(
        {
          source_key: key,
          platform: t.source.platform,
          source: t.source as unknown as Json,
          method: t.method,
          language: t.language,
          duration_ms: t.durationMs,
          words: t.words as unknown as Json,
          lines: t.lines as unknown as Json,
          chunks: t.chunks as unknown as Json,
          created_at: t.createdAt,
        },
        { onConflict: 'source_key' },
      );
      if (error) throw error;

      // Opcional: linhas indexadas para busca entre TODOS os vídeos ("quem falou de combustível?").
      if (o.indexLines) {
        await supabase.from('transcript_lines').delete().eq('source_key', key);
        for (let i = 0; i < t.lines.length; i += 500) {
          const { error: e2 } = await supabase.from('transcript_lines').insert(
            t.lines.slice(i, i + 500).map((l) => ({ source_key: key, line_index: l.index, start_ms: l.startMs, end_ms: l.endMs, text: l.text })),
          );
          if (e2) throw e2;
        }
      }
    },
  };
}
