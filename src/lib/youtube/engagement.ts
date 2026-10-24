// Taxa de engajamento (ER) de vídeo e de canal no YouTube.
//
// Fórmula base:  ER = (curtidas + comentários) ÷ views × 100
// Compartilhamentos ficam de fora: a API pública não expõe esse número.
//
// Detalhes:
//  - curtidas ocultas / comentários desativados viram `null` (não zero) e são sinalizados;
//  - idade do vídeo, views por hora e provável Short no resultado;
//  - ER de canal em 3 versões (ponderado, média, por inscritos), separando longos e Shorts.
import { getVideos, yt, YouTubeError, type QuotaMeter, type YtChannel, type YtVideo } from "./api.ts";
import { parseChannel, parseVideo, type ChannelRef } from "./parse.ts";

// ───────────────────────── tipos ─────────────────────────

export type Tier = "alto" | "medio" | "baixo" | "indefinido";
export type Thresholds = { high: number; medium: number }; // em %

/** Faixas padrão: ≥5 alto, 2–5 médio, <2 baixo. Ajuste por nicho se quiser. */
export const DEFAULT_THRESHOLDS: Thresholds = { high: 5, medium: 2 };

export type VideoEngagement = {
  videoId: string;
  url: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  isShortLikely: boolean; // ≤ 180 s (limite de Shorts desde out/2024); heurística
  ageHours: number;
  views: number;
  likes: number | null; // null = curtidas ocultas pelo canal
  comments: number | null; // null = comentários desativados
  er: number | null; // % com 2 casas; null se views = 0 ou ambos indisponíveis
  erLikes: number | null;
  erComments: number | null;
  viewsPerHour: number;
  tier: Tier;
  flags: string[];
};

export type GroupStats = {
  videos: number;
  totalViews: number;
  avgViews: number;
  erWeighted: number | null; // Σ(curtidas+comentários) ÷ Σ views
  erMean: number | null; // média dos ERs por vídeo
  erMedian: number | null;
  erPerSubscriber: number | null; // média de (curtidas+comentários) ÷ inscritos
  tier: Tier; // pelo ER ponderado
};

export type ChannelEngagement = {
  channelId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
  subscribers: number | null; // null = inscritos ocultos
  totalViews: number | null;
  totalVideos: number | null;
  sample: { requested: number; analyzed: number; skipped: { reason: string; videoId: string }[] };
  all: GroupStats;
  long: GroupStats;
  shorts: GroupStats;
  best: VideoEngagement | null;
  worst: VideoEngagement | null;
  videos: VideoEngagement[];
  quotaUnits: number;
  resolvedVia: ChannelRef["kind"] | "video";
};

// ───────────────────────── utilidades ─────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (s?: string) => (s === undefined ? null : Number(s));
const pct = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : null);

export function tierOf(er: number | null, t: Thresholds = DEFAULT_THRESHOLDS): Tier {
  if (er === null) return "indefinido";
  return er >= t.high ? "alto" : er >= t.medium ? "medio" : "baixo";
}

/** ISO 8601 do YouTube (PT1H2M3S, P1DT2H) → segundos. */
export function isoDurationToSeconds(iso?: string): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return null;
  const [, d = "0", h = "0", mi = "0", s = "0"] = m;
  return +d * 86400 + +h * 3600 + +mi * 60 + +s;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return round2(s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2);
}

// ───────────────────────── vídeo ─────────────────────────

export function computeVideoEngagement(
  v: YtVideo,
  opts: { thresholds?: Thresholds; now?: Date } = {},
): VideoEngagement {
  const now = opts.now ?? new Date();
  const views = num(v.statistics.viewCount) ?? 0;
  const likes = num(v.statistics.likeCount);
  const comments = num(v.statistics.commentCount);
  const duration = isoDurationToSeconds(v.contentDetails?.duration);
  const ageHours = Math.max((now.getTime() - Date.parse(v.snippet.publishedAt)) / 36e5, 0);

  const flags: string[] = [];
  if (likes === null) flags.push("curtidas_ocultas");
  if (comments === null) flags.push("comentarios_desativados");
  if (ageHours < 48) flags.push("video_recente"); // ER ainda inflado pela base fiel
  if (v.snippet.liveBroadcastContent && v.snippet.liveBroadcastContent !== "none") flags.push("ao_vivo_ou_agendado");
  if (views === 0) flags.push("sem_views");

  const interactions = likes === null && comments === null ? null : (likes ?? 0) + (comments ?? 0);
  const er = interactions === null ? null : pct(interactions, views);

  return {
    videoId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.snippet.title,
    channelId: v.snippet.channelId,
    channelTitle: v.snippet.channelTitle,
    publishedAt: v.snippet.publishedAt,
    thumbnailUrl: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.default?.url ?? null,
    durationSeconds: duration,
    isShortLikely: duration !== null && duration > 0 && duration <= 180,
    ageHours: round2(ageHours),
    views,
    likes,
    comments,
    er,
    erLikes: likes === null ? null : pct(likes, views),
    erComments: comments === null ? null : pct(comments, views),
    viewsPerHour: round2(views / Math.max(ageHours, 1)),
    tier: tierOf(er, opts.thresholds),
    flags,
  };
}

/** ER de um vídeo a partir de link, Short ou ID. Custa 1 unidade de cota. */
export async function getVideoEngagement(
  input: string,
  opts: { apiKey?: string; thresholds?: Thresholds } = {},
): Promise<VideoEngagement> {
  const ref = parseVideo(input);
  if (!ref) throw new YouTubeError("Link ou ID de vídeo inválido", 400);
  const [v] = await getVideos([ref.videoId], opts);
  if (!v) throw new YouTubeError("Vídeo não encontrado, privado ou removido", 404);
  return computeVideoEngagement(v, opts);
}

// ───────────────────────── canal ─────────────────────────

export function aggregate(
  vs: VideoEngagement[],
  subscribers: number | null,
  t: Thresholds = DEFAULT_THRESHOLDS,
): GroupStats {
  const valid = vs.filter((v) => v.er !== null);
  const totalViews = vs.reduce((s, v) => s + v.views, 0);
  const validViews = valid.reduce((s, v) => s + v.views, 0);
  const inter = valid.reduce((s, v) => s + (v.likes ?? 0) + (v.comments ?? 0), 0);
  const erWeighted = pct(inter, validViews);
  return {
    videos: vs.length,
    totalViews,
    avgViews: vs.length ? Math.round(totalViews / vs.length) : 0,
    erWeighted,
    erMean: valid.length ? round2(valid.reduce((s, v) => s + (v.er as number), 0) / valid.length) : null,
    erMedian: median(valid.map((v) => v.er as number)),
    erPerSubscriber: subscribers && valid.length ? round2((inter / valid.length / subscribers) * 100) : null,
    tier: tierOf(erWeighted, t),
  };
}

async function resolveChannel(
  ref: ChannelRef,
  o: { apiKey?: string; quota: QuotaMeter },
): Promise<YtChannel | undefined> {
  const part = "snippet,statistics,contentDetails";
  const by = async (params: Record<string, string>) =>
    (await yt<{ items?: YtChannel[] }>("channels", { part, ...params }, o)).items?.[0];

  switch (ref.kind) {
    case "id":
      return by({ id: ref.value });
    case "handle":
      return by({ forHandle: ref.value });
    case "username":
      return (await by({ forUsername: ref.value })) ?? by({ forHandle: `@${ref.value}` });
    case "custom": {
      // /c/nome não tem endpoint próprio: tenta como @handle (1 un.), depois search (100 un.).
      const asHandle = await by({ forHandle: `@${ref.value}` });
      if (asHandle) return asHandle;
      const s = await yt<{ items: { id: { channelId: string } }[] }>(
        "search",
        { part: "id", type: "channel", q: ref.value, maxResults: 1 },
        { ...o, cost: 100 },
      );
      const first = s.items[0];
      return first ? by({ id: first.id.channelId }) : undefined;
    }
  }
}

export type ChannelOptions = {
  apiKey?: string;
  thresholds?: Thresholds;
  /** Quantos uploads recentes considerar (padrão 20, máx. 200). */
  maxVideos?: number;
  /** Ignora vídeos mais novos que isso: ER inicial é inflado pela base fiel (padrão 48 h). */
  minAgeHours?: number;
  /** Ignora vídeos mais antigos que isso, em dias (padrão: sem limite). */
  maxAgeDays?: number;
  now?: Date;
};

/**
 * ER de canal a partir de link do canal, @handle, ID UC… ou link de um vídeo do canal.
 * Cota: ~1 (canal) + 1 por 50 uploads listados + 1 por 50 vídeos lidos. 20 vídeos ≈ 3 unidades.
 */
export async function getChannelEngagement(input: string, opts: ChannelOptions = {}): Promise<ChannelEngagement> {
  const quota: QuotaMeter = { units: 0 };
  const o = { apiKey: opts.apiKey, quota };
  const maxVideos = Math.min(Math.max(opts.maxVideos ?? 20, 1), 200);
  const minAgeHours = opts.minAgeHours ?? 48;
  const now = opts.now ?? new Date();

  // 1) Resolver o canal
  let ref = parseChannel(input);
  let resolvedVia: ChannelEngagement["resolvedVia"] = ref?.kind ?? "video";
  if (!ref) {
    const vRef = parseVideo(input);
    if (!vRef) throw new YouTubeError("Link de canal, @handle ou vídeo inválido", 400);
    const [v] = await getVideos([vRef.videoId], o);
    if (!v) throw new YouTubeError("Vídeo não encontrado", 404);
    ref = { kind: "id", value: v.snippet.channelId };
    resolvedVia = "video";
  }
  const ch = await resolveChannel(ref, o);
  if (!ch) throw new YouTubeError("Canal não encontrado", 404);
  const subscribers = ch.statistics.hiddenSubscriberCount ? null : num(ch.statistics.subscriberCount);

  // 2) Listar uploads recentes. Pegamos uma folga para compensar os que serão pulados.
  const want = Math.min(maxVideos + 10, 250);
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await yt<{ items: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>(
      "playlistItems",
      { part: "contentDetails", playlistId: ch.contentDetails.relatedPlaylists.uploads, maxResults: 50, pageToken },
      o,
    );
    ids.push(...page.items.map((i) => i.contentDetails.videoId));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < want);

  // 3) Estatísticas em lote e filtros
  const raw = await getVideos(ids.slice(0, want), o);
  raw.sort((a, b) => Date.parse(b.snippet.publishedAt) - Date.parse(a.snippet.publishedAt));

  const skipped: { reason: string; videoId: string }[] = [];
  const videos: VideoEngagement[] = [];
  for (const v of raw) {
    if (videos.length >= maxVideos) break;
    const e = computeVideoEngagement(v, { thresholds: opts.thresholds, now });
    if (e.flags.includes("ao_vivo_ou_agendado")) skipped.push({ reason: "ao_vivo_ou_agendado", videoId: e.videoId });
    else if (e.ageHours < minAgeHours) skipped.push({ reason: `menos_de_${minAgeHours}h`, videoId: e.videoId });
    else if (opts.maxAgeDays && e.ageHours > opts.maxAgeDays * 24)
      skipped.push({ reason: "antigo_demais", videoId: e.videoId });
    else if (e.er === null) skipped.push({ reason: e.flags.join("+") || "sem_dados", videoId: e.videoId });
    // Curtidas ocultas: o ER sairia só com comentários e puxaria a média do canal para baixo.
    else if (e.likes === null) skipped.push({ reason: "curtidas_ocultas", videoId: e.videoId });
    else videos.push(e);
  }

  // 4) Agregados
  const t = opts.thresholds;
  const ranked = [...videos].sort((a, b) => (b.er ?? 0) - (a.er ?? 0));
  return {
    channelId: ch.id,
    title: ch.snippet.title,
    handle: ch.snippet.customUrl ?? null,
    thumbnailUrl: ch.snippet.thumbnails?.high?.url ?? ch.snippet.thumbnails?.default?.url ?? null,
    subscribers,
    totalViews: num(ch.statistics.viewCount),
    totalVideos: num(ch.statistics.videoCount),
    sample: { requested: maxVideos, analyzed: videos.length, skipped },
    all: aggregate(videos, subscribers, t),
    long: aggregate(
      videos.filter((v) => !v.isShortLikely),
      subscribers,
      t,
    ),
    shorts: aggregate(
      videos.filter((v) => v.isShortLikely),
      subscribers,
      t,
    ),
    best: ranked[0] ?? null,
    worst: ranked.at(-1) ?? null,
    videos,
    quotaUnits: quota.units,
    resolvedVia,
  };
}
