// Resolve um clip da Twitch em URLs de MP4 baixáveis.
//
// Como funciona (o mesmo caminho do untwitch e do Clipr):
//   1. GQL `clip(slug)` devolve as qualidades (sourceURL de cada MP4) e um
//      playbackAccessToken { signature, value }.
//   2. A URL final é  sourceURL + ?sig=<signature>&token=<value url-encoded>.
//   3. Esse MP4 está num CloudFront que responde 206 a Range e manda
//      Access-Control-Allow-Origin: *  → o navegador pode ler direto.
//   4. O token expira em ~20 h (campo `expires` dentro de `value`).
//
// Bônus: alguns clips têm um asset RECOMPOSED (0.56 = 9:16) que a própria
// Twitch já gerou na vertical. Útil como "atalho" no clipador.
import { gql, TwitchError } from "./gql.ts";

export type ClipQuality = {
  quality: string; // "1080" | "720" | "480" | "360"
  frameRate: number;
  codecs?: string;
  url: string; // já assinada
};

export type ResolvedClip = {
  slug: string;
  id: string;
  title: string;
  channel: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
  createdAt: string;
  vodOffset: { vodId: string; offsetSeconds: number } | null;
  landscape: ClipQuality[]; // ordenado da maior para a menor
  portrait: ClipQuality[]; // vazio se a Twitch não recompôs o clip
  expiresAt: string; // validade das URLs assinadas
};

const CLIP_QUERY = /* GraphQL */ `
  query ClipResolve($slug: ID!) {
    clip(slug: $slug) {
      id
      slug
      title
      durationSeconds
      createdAt
      thumbnailURL(width: 1280, height: 720)
      broadcaster { login }
      video { id }
      videoOffsetSeconds
      videoQualities { quality frameRate sourceURL }
      assets {
        type
        aspectRatio
        videoQualities { quality frameRate codecs sourceURL }
      }
      playbackAccessToken(
        params: { platform: "web", playerBackend: "mediaplayer", playerType: "site" }
      ) { signature value }
    }
  }
`;

type GqlQuality = { quality: string; frameRate: number; codecs?: string; sourceURL: string };
type GqlClip = {
  clip: null | {
    id: string;
    slug: string;
    title: string;
    durationSeconds: number;
    createdAt: string;
    thumbnailURL: string | null;
    broadcaster: { login: string } | null;
    video: { id: string } | null;
    videoOffsetSeconds: number | null;
    videoQualities: GqlQuality[];
    assets: { type: string; aspectRatio: number; videoQualities: GqlQuality[] }[] | null;
    playbackAccessToken: { signature: string; value: string } | null;
  };
};

export async function resolveClip(slug: string): Promise<ResolvedClip> {
  const { clip } = await gql<GqlClip>(CLIP_QUERY, { slug });
  if (!clip) throw new TwitchError("Clip não encontrado ou removido", 404);
  const tok = clip.playbackAccessToken;
  if (!tok) throw new TwitchError("Clip sem token de acesso", 502);

  const sign = (u: string) => `${u}?sig=${tok.signature}&token=${encodeURIComponent(tok.value)}`;
  const map = (qs: GqlQuality[] = []): ClipQuality[] =>
    qs
      .map((q) => ({ quality: q.quality, frameRate: Math.round(q.frameRate), codecs: q.codecs, url: sign(q.sourceURL) }))
      .sort((a, b) => Number(b.quality) - Number(a.quality));

  const source = clip.assets?.find((a) => a.type === "SOURCE");
  const portrait = clip.assets?.find((a) => a.aspectRatio < 1);

  let expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  try {
    const exp = (JSON.parse(tok.value) as { expires?: number }).expires;
    if (exp) expiresAt = new Date(exp * 1000).toISOString();
  } catch {
    // mantém 1 h por segurança
  }

  return {
    slug: clip.slug,
    id: clip.id,
    title: clip.title,
    channel: clip.broadcaster?.login ?? "",
    durationSeconds: clip.durationSeconds,
    thumbnailUrl: clip.thumbnailURL,
    createdAt: clip.createdAt,
    vodOffset:
      clip.video && clip.videoOffsetSeconds != null
        ? { vodId: clip.video.id, offsetSeconds: clip.videoOffsetSeconds }
        : null,
    // assets.SOURCE traz `codecs`; videoQualities é o fallback antigo.
    landscape: map(source?.videoQualities?.length ? source.videoQualities : clip.videoQualities),
    portrait: map(portrait?.videoQualities),
    expiresAt,
  };
}

/** Melhor qualidade até `maxHeight` (padrão 1080). Prefere H.264 (avc1). */
export function pickClipQuality(list: ClipQuality[], maxHeight = 1080): ClipQuality | undefined {
  const ok = list.filter((q) => Number(q.quality) <= maxHeight);
  return ok.find((q) => !q.codecs || q.codecs.startsWith("avc1")) ?? ok[0] ?? list.at(-1);
}
