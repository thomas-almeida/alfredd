// `complete(prompt)` padrão para suggestHighlights, via API compatível com OpenAI.
// Padrão OpenRouter; troque por env: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL.

import 'server-only';

import { TranscriptError } from './types.ts';

export function geminiComplete(o: { apiKey?: string; model?: string; temperature?: number } = {}) {
  const apiKey = o.apiKey ?? process.env.GEMINI_API_KEY;
  const model = o.model ?? process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
  if (!apiKey) throw new TranscriptError('Defina GEMINI_API_KEY', 500, 'no_llm');

  return async (prompt: string): Promise<string> => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: o.temperature ?? 0.3, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new TranscriptError(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, 502, 'llm_http');
    const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  };
}

export function openAiCompatibleComplete(o: { baseUrl?: string; apiKey?: string; model?: string; temperature?: number } = {}) {
  const baseUrl = o.baseUrl ?? process.env.LLM_BASE_URL ?? 'https://openrouter.ai/api/v1';
  const apiKey = o.apiKey ?? process.env.LLM_API_KEY ?? process.env.OPENROUTER_API_KEY;
  const model = o.model ?? process.env.LLM_MODEL;
  if (!apiKey || !model) throw new TranscriptError('Defina LLM_API_KEY e LLM_MODEL', 500, 'no_llm');

  return async (prompt: string): Promise<string> => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: o.temperature ?? 0.3, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new TranscriptError(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`, 502, 'llm_http');
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? '';
  };
}
