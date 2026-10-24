// De onde vem o áudio de cada origem, e como interpretar o link colado pelo usuário.
// Integra com o módulo lib/twitch (entregue antes) para clips e VODs.

import 'server-only';

import { spawn } from 'node:child_process';
import { parseTwitchUrl, pickClipQuality, pickVariant, resolveClip, resolveVod } from '@/lib/twitch/media';
import { TranscriptError, type TranscriptSource } from './types.ts';

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (YT_ID.test(s)) return s;
  try {
    const u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`);
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    const parts = u.pathname.split('/').filter(Boolean);
    const id =
      host === 'youtu.be' ? parts[0]
      : host === 'youtube.com' && parts[0] === 'watch' ? u.searchParams.get('v')
      : host === 'youtube.com' && ['shorts', 'embed', 'live'].includes(parts[0] ?? '') ? parts[1]
      : null;
    return id && YT_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** Link de YouTube ou Twitch → origem. VOD da Twitch exige a janela (startMs/endMs). */
export function parseSource(input: string, vodWindow?: { startMs: number; endMs: number }): TranscriptSource | null {
  const yt = parseYouTubeId(input);
  if (yt) return { platform: 'youtube', videoId: yt };
  const tw = parseTwitchUrl(input);
  if (tw?.kind === 'clip') return { platform: 'twitch_clip', slug: tw.slug };
  if (tw?.kind === 'vod') {
    if (!vodWindow) throw new TranscriptError('Para VOD da Twitch informe startMs e endMs', 400, 'vod_window');
    return { platform: 'twitch_vod', vodId: tw.id, ...vodWindow };
  }
  return null;
}

/**
 * URL de áudio do YouTube via yt-dlp (precisa do binário no servidor: `pip install yt-dlp`).
 * O ffmpeg lê essa URL direto; ela expira em algumas horas.
 */
export function youtubeAudioUrl(videoId: string): Promise<string> {
  const bin = process.env.YTDLP_PATH ?? 'yt-dlp';
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ['-g', '-f', 'bestaudio[ext=m4a]/bestaudio', '--no-warnings', `https://www.youtube.com/watch?v=${videoId}`]);
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', () => reject(new TranscriptError('yt-dlp não instalado no servidor', 500, 'ytdlp_missing')));
    p.on('close', (code) =>
      code === 0 && out.trim()
        ? resolve(out.trim().split('\n')[0] ?? '')
        : reject(new TranscriptError(`yt-dlp falhou: ${err.slice(-300)}`, 502, 'ytdlp_failed')),
    );
  });
}

/** Entrada para o ffmpeg (URL ou arquivo) + janela de tempo, por origem. */
export async function audioInputFor(
  s: TranscriptSource,
): Promise<{ input: string; startMs?: number; endMs?: number; hint?: string }> {
  switch (s.platform) {
    case 'youtube':
      return { input: await youtubeAudioUrl(s.videoId) };
    case 'twitch_clip': {
      const clip = await resolveClip(s.slug);
      // menor qualidade basta para áudio e baixa bem menos
      const q = pickClipQuality(clip.landscape, 360) ?? clip.landscape.at(-1);
      if (!q) throw new TranscriptError('Clip sem mídia', 404, 'no_media');
      return { input: q.url, hint: `${clip.title}. Canal ${clip.channel}.` };
    }
    case 'twitch_vod': {
      const vod = await resolveVod(s.vodId);
      const audio = vod.variants.find((v) => v.name.includes('audio')) ?? pickVariant(vod.variants, 360);
      return { input: audio.url, startMs: s.startMs, endMs: s.endMs, hint: `${vod.title}. Canal ${vod.channel}.` };
    }
    case 'file':
      return { input: s.key };
  }
}
