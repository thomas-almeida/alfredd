import "server-only";
import { pickBestQuality, type ClipQuality } from "./clip-slug";

// Client-ID público do site da Twitch, aceito pelo GQL sem login.
const GQL_URL = "https://gql.twitch.tv/gql";
const WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const ACCESS_TOKEN_HASH =
  "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11";

export interface ResolvedClip {
  url: string;
  height: number;
  fps: number | null;
}

/**
 * Resolve a URL do MP4 de um clipe via GQL (VideoAccessToken_Clip), assinando
 * com o token de playback. Escolhe a melhor qualidade até 1080p.
 */
export async function resolveClipMp4(slug: string): Promise<ResolvedClip> {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Client-ID": WEB_CLIENT_ID, "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "VideoAccessToken_Clip",
      variables: { slug },
      extensions: {
        persistedQuery: { version: 1, sha256Hash: ACCESS_TOKEN_HASH },
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`gql_${res.status}`);

  const json = (await res.json()) as {
    data?: {
      clip: {
        playbackAccessToken: { signature: string; value: string };
        videoQualities: ClipQuality[];
      } | null;
    };
  };
  const clip = json.data?.clip;
  if (!clip) throw new Error("clip_not_found");

  const best = pickBestQuality(clip.videoQualities);
  if (!best) throw new Error("no_quality");

  const u = new URL(best.sourceURL);
  u.searchParams.set("sig", clip.playbackAccessToken.signature);
  u.searchParams.set("token", clip.playbackAccessToken.value);
  return {
    url: u.toString(),
    height: Number.parseInt(best.quality, 10),
    fps: best.frameRate ?? null,
  };
}
