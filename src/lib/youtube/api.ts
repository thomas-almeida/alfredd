// Cliente mínimo da YouTube Data API v3 (oficial, chave em YOUTUBE_API_KEY).
// Cota diária padrão: 10.000 unidades. Cada chamada list abaixo custa 1 unidade;
// search.list custa 100 (só usado para links /c/ antigos).

const BASE = "https://www.googleapis.com/youtube/v3";

export class YouTubeError extends Error {
  status: number;
  reason?: string;

  constructor(message: string, status = 502, reason?: string) {
    super(message);
    this.name = "YouTubeError";
    this.status = status;
    this.reason = reason;
  }
}

export type QuotaMeter = { units: number };

export type YtVideo = {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails?: Record<string, { url: string }>;
    liveBroadcastContent?: "none" | "live" | "upcoming";
  };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration: string };
};

export type YtChannel = {
  id: string;
  snippet: { title: string; customUrl?: string; thumbnails?: Record<string, { url: string }> };
  statistics: { subscriberCount?: string; hiddenSubscriberCount: boolean; viewCount?: string; videoCount?: string };
  contentDetails: { relatedPlaylists: { uploads: string } };
};

export async function yt<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  opts: { apiKey?: string; quota?: QuotaMeter; cost?: number } = {},
): Promise<T> {
  const key = opts.apiKey ?? process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError("YOUTUBE_API_KEY não configurada", 500);
  const qs = new URLSearchParams({ key });
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));

  const res = await fetch(`${BASE}/${path}?${qs}`, { cache: "no-store" });
  if (opts.quota) opts.quota.units += opts.cost ?? 1;
  const json = (await res.json()) as T & { error?: { message: string; errors?: { reason: string }[] } };
  if (!res.ok || json.error) {
    const reason = json.error?.errors?.[0]?.reason;
    const status = reason === "quotaExceeded" ? 429 : res.status === 404 ? 404 : 502;
    throw new YouTubeError(`YouTube API: ${json.error?.message ?? res.status}`, status, reason);
  }
  return json;
}

/** videos.list em lotes de 50 (1 unidade por lote). */
export async function getVideos(ids: string[], o: { apiKey?: string; quota?: QuotaMeter } = {}): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await yt<{ items: YtVideo[] }>(
      "videos",
      { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(","), maxResults: 50 },
      o,
    );
    out.push(...r.items);
  }
  return out;
}
