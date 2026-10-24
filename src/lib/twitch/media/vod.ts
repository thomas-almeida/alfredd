// Resolve um VOD da Twitch em playlists HLS e em uma "janela" de segmentos.
//
// O VOD é uma lista de segmentos .ts de ~10 s em
//   https://<cloudfront>/<pasta>/<qualidade>/index-dvr.m3u8
// O usuário escolhe início/fim; o SERVIDOR baixa só esses segmentos e junta
// num arquivo (o CDN não libera CORS, então não dá para fazer no navegador).
//
// Dois caminhos para achar as playlists:
//   A) Oficial do player: token GQL → master playlist do usher (todas as qualidades).
//   B) Fallback: a pasta do VOD é a mesma do `seekPreviewsURL` (storyboard);
//      monta  https://<host>/<pasta>/<qualidade>/index-dvr.m3u8  direto.
//      Funciona quando o usher recusa (ex.: VOD só para inscritos).
import { gql, TwitchError } from "./gql.ts";

export type VodVariant = { name: string; resolution?: string; bandwidth?: number; url: string };
export type Segment = { index: number; start: number; duration: number; url: string };

export type ResolvedVod = {
  id: string;
  title: string;
  channel: string;
  lengthSeconds: number;
  createdAt: string;
  thumbnailUrl: string | null;
  variants: VodVariant[]; // maior qualidade primeiro
  via: "usher" | "storyboard";
};

const VOD_QUERY = /* GraphQL */ `
  query VodResolve($id: ID!) {
    video(id: $id) {
      id
      title
      lengthSeconds
      createdAt
      seekPreviewsURL
      previewThumbnailURL(width: 1280, height: 720)
      owner { login }
    }
    videoPlaybackAccessToken(
      id: $id
      params: { platform: "web", playerBackend: "mediaplayer", playerType: "site" }
    ) { signature value }
  }
`;

type GqlVod = {
  video: null | {
    id: string;
    title: string;
    lengthSeconds: number;
    createdAt: string;
    seekPreviewsURL: string | null;
    previewThumbnailURL: string | null;
    owner: { login: string } | null;
  };
  videoPlaybackAccessToken: { signature: string; value: string } | null;
};

// Pastas de qualidade usadas pelo CDN de VOD. "chunked" = source.
const QUALITY_FOLDERS = ["chunked", "1080p60", "1080p30", "720p60", "720p30", "480p30", "360p30", "160p30", "audio_only"];

export async function resolveVod(id: string): Promise<ResolvedVod> {
  const data = await gql<GqlVod>(VOD_QUERY, { id });
  const v = data.video;
  if (!v) throw new TwitchError("VOD não encontrado ou removido", 404);

  const base = {
    id: v.id,
    title: v.title,
    channel: v.owner?.login ?? "",
    lengthSeconds: v.lengthSeconds,
    createdAt: v.createdAt,
    thumbnailUrl: v.previewThumbnailURL,
  };

  // A) usher
  const tok = data.videoPlaybackAccessToken;
  if (tok) {
    const usher =
      `https://usher.ttvnw.net/vod/${id}.m3u8?` +
      new URLSearchParams({
        nauth: tok.value,
        nauthsig: tok.signature,
        allow_source: "true",
        allow_audio_only: "true",
        playlist_include_framerate: "true",
        player: "twitchweb",
      });
    const res = await fetch(usher, { cache: "no-store" });
    if (res.ok) {
      const variants = parseMaster(await res.text());
      if (variants.length) return { ...base, variants, via: "usher" };
    }
  }

  // B) storyboard
  if (v.seekPreviewsURL) {
    const sp = new URL(v.seekPreviewsURL);
    const folder = sp.pathname.split("/").filter(Boolean)[0];
    const variants: VodVariant[] = [];
    if (folder) {
      for (const q of QUALITY_FOLDERS) {
        const url = `${sp.origin}/${folder}/${q}/index-dvr.m3u8`;
        const head = await fetch(url, { method: "HEAD", cache: "no-store" }).catch(() => null);
        if (head?.ok) variants.push({ name: q === "chunked" ? "source" : q, url });
      }
    }
    if (variants.length) return { ...base, variants, via: "storyboard" };
  }

  throw new TwitchError("Não foi possível obter as playlists do VOD", 502);
}

/** Lê a master playlist do usher → variantes (nome, resolução, URL). */
export function parseMaster(text: string): VodVariant[] {
  const lines = text.split("\n").map((l) => l.trim());
  const names = new Map<string, string>(); // GROUP-ID → NAME
  for (const l of lines) {
    if (l.startsWith("#EXT-X-MEDIA")) {
      const g = /GROUP-ID="([^"]+)"/.exec(l)?.[1];
      const n = /NAME="([^"]+)"/.exec(l)?.[1];
      if (g && n) names.set(g, n);
    }
  }
  const out: VodVariant[] = [];
  lines.forEach((l, i) => {
    if (!l.startsWith("#EXT-X-STREAM-INF")) return;
    const url = lines[i + 1];
    if (!url?.startsWith("http")) return;
    const group = /VIDEO="([^"]+)"/.exec(l)?.[1] ?? "";
    out.push({
      name: names.get(group) ?? group,
      resolution: /RESOLUTION=(\d+x\d+)/.exec(l)?.[1],
      bandwidth: Number(/BANDWIDTH=(\d+)/.exec(l)?.[1] ?? 0),
      url,
    });
  });
  return out.sort((a, b) => (b.bandwidth ?? 0) - (a.bandwidth ?? 0));
}

/** Lê o texto de uma playlist de mídia → segmentos com tempo absoluto. */
export function parseMediaPlaylist(text: string, variantUrl: string): Segment[] {
  const baseUrl = variantUrl.slice(0, variantUrl.lastIndexOf("/") + 1);
  const segs: Segment[] = [];
  let t = 0;
  let dur = 0;
  for (const raw of text.split("\n")) {
    const l = raw.trim();
    if (l.startsWith("#EXTINF:")) dur = parseFloat(l.slice(8));
    else if (l && !l.startsWith("#")) {
      segs.push({ index: segs.length, start: t, duration: dur, url: l.startsWith("http") ? l : baseUrl + l });
      t += dur;
    }
  }
  return segs;
}

/** Baixa e lê a playlist de mídia (index-dvr.m3u8). */
export async function getSegments(variantUrl: string): Promise<Segment[]> {
  const res = await fetch(variantUrl, { cache: "no-store" });
  if (!res.ok) throw new TwitchError(`Playlist HTTP ${res.status}`, 502);
  return parseMediaPlaylist(await res.text(), variantUrl);
}

/**
 * Segmentos que cobrem [start, end] em segundos. Devolve também o deslocamento
 * para um corte preciso com ffmpeg (-ss/-t).
 */
export function selectWindow(segs: Segment[], start: number, end: number) {
  if (end <= start) throw new TwitchError("Fim deve ser maior que o início", 400);
  const chosen = segs.filter((s) => s.start + s.duration > start && s.start < end);
  if (!chosen.length) throw new TwitchError("Janela fora do VOD", 400);
  return {
    segments: chosen,
    trimStart: start - chosen[0]!.start, // quanto pular dentro do 1º segmento
    duration: end - start,
  };
}

/** Playlist local só com a janela escolhida (o ffmpeg lê isso como entrada). */
export function buildWindowPlaylist(segments: Segment[]): string {
  const target = Math.ceil(Math.max(...segments.map((s) => s.duration)));
  return [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-TARGETDURATION:${target}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:VOD",
    ...segments.flatMap((s) => [`#EXTINF:${s.duration.toFixed(3)},`, s.url]),
    "#EXT-X-ENDLIST",
    "",
  ].join("\n");
}

/** Maior qualidade de vídeo até `maxHeight` (ignora "Audio Only"); se nenhuma couber, a menor. */
export function pickVariant(variants: VodVariant[], maxHeight = 1080): VodVariant {
  const h = (v: VodVariant) => Number(v.resolution?.split("x")[1] ?? /(\d+)p/.exec(v.name)?.[1] ?? 0);
  const video = variants.filter((v) => !/audio/i.test(v.name));
  const chosen = video.find((v) => h(v) <= maxHeight) ?? video.at(-1) ?? variants[0];
  if (!chosen) throw new TwitchError("VOD sem qualidades", 502);
  return chosen;
}
