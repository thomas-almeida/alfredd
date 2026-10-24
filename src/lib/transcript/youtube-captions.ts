// Legendas do próprio YouTube, como o ytultra faz (confirmado: 35 KB em 1,3 s,
// marcador ">>" de falante, erros típicos do ASR do YouTube).
//
// Diferença para o ytultra: pedimos o formato json3 e GUARDAMOS o tempo de cada
// palavra (tOffsetMs), que é o que permite cortar no ponto exato.
//
// Caminho:
//   1. Descobrir as faixas de legenda (captionTracks) do vídeo:
//        a) InnerTube /youtubei/v1/player com um cliente de app (padrão: ANDROID)
//        b) fallback: HTML da página do vídeo → ytInitialPlayerResponse
//   2. Escolher a faixa (idioma preferido; manual antes de automática, ou o contrário)
//   3. Baixar  baseUrl + &fmt=json3  e converter em palavras.
//
// API interna e não documentada: o YouTube muda clientes e às vezes exige token
// (PO token) para servidores em datacenter. Por isso tudo aqui é "melhor esforço"
// e o orquestrador cai no Whisper quando falha. Versões de cliente vêm de env.

import 'server-only';

import { TranscriptError, type Word } from './types.ts';

export type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string; // 'asr' = automática
  name: string;
  vssId?: string;
};

const UA_ANDROID = 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip';
const UA_WEB =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: { lengthSeconds?: string; title?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: {
        baseUrl: string;
        languageCode: string;
        kind?: string;
        vssId?: string;
        name?: { simpleText?: string; runs?: { text: string }[] };
      }[];
    };
  };
};

function tracksFrom(p: PlayerResponse): CaptionTrack[] {
  const list = p.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  return list.map((t) => ({
    baseUrl: t.baseUrl,
    languageCode: t.languageCode,
    kind: t.kind,
    vssId: t.vssId,
    name: t.name?.simpleText ?? t.name?.runs?.map((r) => r.text).join('') ?? t.languageCode,
  }));
}

async function viaInnertube(videoId: string): Promise<PlayerResponse> {
  const clientName = process.env.YT_INNERTUBE_CLIENT ?? 'ANDROID';
  const clientVersion = process.env.YT_INNERTUBE_CLIENT_VERSION ?? '20.10.38';
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA_ANDROID },
    body: JSON.stringify({
      context: { client: { clientName, clientVersion, androidSdkVersion: 34, hl: 'pt', gl: 'BR' } },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new TranscriptError(`InnerTube HTTP ${res.status}`, 502, 'innertube_http');
  return (await res.json()) as PlayerResponse;
}

async function viaWatchPage(videoId: string): Promise<PlayerResponse> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=pt`, {
    headers: { 'User-Agent': UA_WEB, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    cache: 'no-store',
  });
  if (!res.ok) throw new TranscriptError(`Página do vídeo HTTP ${res.status}`, 502, 'watch_http');
  const html = await res.text();
  if (html.includes('g-recaptcha') || html.includes('confirm you’re not a bot')) {
    throw new TranscriptError('YouTube pediu verificação anti-robô', 503, 'bot_check');
  }
  const m = /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s|<\/script>)/s.exec(html);
  if (!m) throw new TranscriptError('ytInitialPlayerResponse não encontrado', 502, 'no_player_response');
  return JSON.parse(m[1] ?? '') as PlayerResponse;
}

/** Lista as faixas de legenda disponíveis (tenta InnerTube, depois a página). */
export async function listCaptionTracks(videoId: string): Promise<{ tracks: CaptionTrack[]; durationMs: number | null }> {
  const errors: string[] = [];
  for (const get of [viaInnertube, viaWatchPage]) {
    try {
      const p = await get(videoId);
      const status = p.playabilityStatus?.status;
      if (status && status !== 'OK') {
        errors.push(`${get.name}: ${status} ${p.playabilityStatus?.reason ?? ''}`.trim());
        continue;
      }
      const tracks = tracksFrom(p);
      const secs = Number(p.videoDetails?.lengthSeconds ?? NaN);
      if (tracks.length) return { tracks, durationMs: Number.isFinite(secs) ? secs * 1000 : null };
      errors.push(`${get.name}: sem legendas`);
    } catch (e) {
      errors.push(`${get.name}: ${(e as Error).message}`);
    }
  }
  throw new TranscriptError(`Sem legendas utilizáveis (${errors.join(' | ')})`, 404, 'no_captions');
}

/**
 * Escolhe a faixa. Ordem: idiomas preferidos; dentro do idioma, manual antes
 * de automática (texto melhor), a menos que `preferAsr` (automática tem tempo por palavra).
 */
export function pickTrack(
  tracks: CaptionTrack[],
  opts: { languages?: string[]; preferAsr?: boolean } = {},
): CaptionTrack | undefined {
  const langs = (opts.languages ?? ['pt', 'pt-BR', 'pt-PT']).map((l) => l.toLowerCase());
  const rank = (t: CaptionTrack) => {
    const li = langs.findIndex((l) => t.languageCode.toLowerCase() === l || t.languageCode.toLowerCase().startsWith(l + '-'));
    const langScore = li === -1 ? 100 : li;
    const isAsr = t.kind === 'asr' ? 1 : 0;
    return langScore * 10 + (opts.preferAsr ? 1 - isAsr : isAsr);
  };
  return [...tracks].sort((a, b) => rank(a) - rank(b))[0];
}

// ───────────── json3 → palavras ─────────────

type Json3 = {
  events?: {
    tStartMs?: number;
    dDurationMs?: number;
    aAppend?: number;
    segs?: { utf8?: string; tOffsetMs?: number }[];
  }[];
};

const MAX_WORD_MS = 1500;

/** Converte json3 em palavras. ASR traz tempo por palavra; legenda manual é interpolada. */
export function parseJson3(data: Json3): { words: Word[]; isAsr: boolean } {
  const raw: (Word & { capMs: number })[] = [];
  let isAsr = false;
  let pendingSpeaker = false;

  for (const ev of data.events ?? []) {
    if (!ev.segs?.length || ev.tStartMs === undefined) continue;
    const evStart = ev.tStartMs;
    const evEnd = evStart + (ev.dDurationMs ?? 0);
    const segs = ev.segs.filter((s) => s.utf8 && s.utf8 !== '\n');
    if (!segs.length) continue;
    const timed = segs.length > 1 || segs.some((s) => s.tOffsetMs !== undefined);

    if (timed) {
      isAsr = true;
      for (const s of segs) {
        for (const tok of s.utf8!.trim().split(/\s+/).filter(Boolean)) {
          if (tok === '>>') { pendingSpeaker = true; continue; }
          raw.push({
            text: tok,
            startMs: evStart + (s.tOffsetMs ?? 0),
            endMs: 0,
            capMs: evEnd || evStart + MAX_WORD_MS,
            ...(pendingSpeaker && { speakerChange: true }),
          });
          pendingSpeaker = false;
        }
      }
    } else {
      // Legenda manual: um bloco de texto por evento → distribui o tempo pelo tamanho das palavras.
      const toks = segs.map((s) => s.utf8!).join(' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      const dur = Math.max(evEnd - evStart, 200);
      const total = toks.reduce((n, t) => n + t.length + 1, 0);
      let acc = 0;
      for (const tok of toks) {
        if (tok === '>>') { pendingSpeaker = true; continue; }
        const st = evStart + Math.round((acc / total) * dur);
        acc += tok.length + 1;
        raw.push({
          text: tok,
          startMs: st,
          endMs: evStart + Math.round((acc / total) * dur),
          capMs: evEnd,
          estimated: true,
          ...(pendingSpeaker && { speakerChange: true }),
        });
        pendingSpeaker = false;
      }
    }
  }

  raw.sort((a, b) => a.startMs - b.startMs);
  const words: Word[] = raw.map((w, i) => {
    const next = raw[i + 1];
    let end = w.endMs || Math.min(next ? next.startMs : w.capMs, w.capMs, w.startMs + MAX_WORD_MS);
    if (end <= w.startMs) end = w.startMs + 80;
    const { capMs, ...rest } = w;
    return { ...rest, endMs: end };
  });
  return { words, isAsr };
}

export async function fetchTrackWords(track: CaptionTrack): Promise<{ words: Word[]; isAsr: boolean }> {
  const u = new URL(track.baseUrl);
  u.searchParams.set('fmt', 'json3');
  const res = await fetch(u, { headers: { 'User-Agent': UA_ANDROID }, cache: 'no-store' });
  if (!res.ok) throw new TranscriptError(`Legenda HTTP ${res.status}`, 502, 'timedtext_http');
  const text = await res.text();
  if (!text.trim()) throw new TranscriptError('Legenda veio vazia (provável exigência de PO token)', 502, 'timedtext_empty');
  return parseJson3(JSON.parse(text));
}

/** Atalho: vídeo → palavras com tempo. Lança TranscriptError se não houver legenda. */
export async function getYouTubeCaptionWords(
  videoId: string,
  opts: { languages?: string[]; preferAsr?: boolean } = {},
): Promise<{ words: Word[]; language: string; isAsr: boolean; durationMs: number | null; track: CaptionTrack }> {
  const { tracks, durationMs } = await listCaptionTracks(videoId);
  const track = pickTrack(tracks, { preferAsr: true, ...opts });
  if (!track) throw new TranscriptError('Nenhuma faixa de legenda', 404, 'no_captions');
  const { words, isAsr } = await fetchTrackWords(track);
  if (!words.length) throw new TranscriptError('Legenda sem texto', 404, 'empty_captions');
  return { words, language: track.languageCode.split('-')[0] ?? track.languageCode, isAsr, durationMs, track };
}
