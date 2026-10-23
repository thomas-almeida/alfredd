import "server-only";
import { getHelixAuthHeaders } from "./token";

/**
 * Client fino da Twitch Helix API. Server-only, com backoff em 429/5xx.
 * Os métodos de alto nível (search/clips) serão exercitados na Fase 1; aqui
 * fica a base tipada e resiliente.
 *
 * Regras importantes (ver guia §6):
 *  - game_id e broadcaster_id são mutuamente exclusivos em /clips.
 *  - /clips retorna por views (desc), não por data: reordenar localmente.
 *  - trabalhar em UTC, paginar por cursor, deduplicar por id.
 */

const HELIX = "https://api.twitch.tv/helix";

export interface HelixPage<T> {
  data: T[];
  pagination?: { cursor?: string };
}

export interface TwitchCategory {
  id: string;
  name: string;
  box_art_url: string;
}

export interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  game_id: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  language: string;
}

type Param = string | number | string[] | undefined;

async function helixFetch<T>(
  path: string,
  params: Record<string, Param>,
  attempt = 0,
): Promise<HelixPage<T>> {
  const headers = await getHelixAuthHeaders();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item) qs.append(k, String(item));
    } else {
      qs.set(k, String(v));
    }
  }

  const res = await fetch(`${HELIX}${path}?${qs.toString()}`, {
    headers,
    cache: "no-store",
  });

  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    const retryAfter = Number(res.headers.get("Ratelimit-Reset")) || 0;
    const waitMs = retryAfter
      ? Math.max(0, retryAfter * 1000 - Date.now())
      : 2 ** attempt * 500;
    await new Promise((r) => setTimeout(r, Math.min(waitMs, 8000)));
    return helixFetch<T>(path, params, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`Helix ${path} falhou: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as HelixPage<T>;
}

export const twitch = {
  searchCategories(query: string, first = 20) {
    return helixFetch<TwitchCategory>("/search/categories", { query, first });
  },
  searchChannels(query: string, first = 20) {
    return helixFetch<{
      id: string;
      broadcaster_login: string;
      display_name: string;
      thumbnail_url: string;
      game_name: string;
    }>("/search/channels", { query, first });
  },
  clipsByGame(gameId: string, opts: ClipQueryOptions = {}) {
    return helixFetch<TwitchClip>("/clips", {
      game_id: gameId,
      first: opts.first ?? 50,
      after: opts.after,
      started_at: opts.startedAt,
      ended_at: opts.endedAt,
    });
  },
  clipsByBroadcaster(broadcasterId: string, opts: ClipQueryOptions = {}) {
    return helixFetch<TwitchClip>("/clips", {
      broadcaster_id: broadcasterId,
      first: opts.first ?? 50,
      after: opts.after,
      started_at: opts.startedAt,
      ended_at: opts.endedAt,
    });
  },
  clipsByIds(ids: string[]) {
    return helixFetch<TwitchClip>("/clips", { id: ids.slice(0, 100) });
  },
  gamesByIds(ids: string[]) {
    return helixFetch<TwitchCategory>("/games", { id: ids.slice(0, 100) });
  },
  usersByLogin(logins: string[]) {
    return helixFetch<{
      id: string;
      login: string;
      display_name: string;
      profile_image_url: string;
    }>("/users", { login: logins.slice(0, 100) });
  },
  usersByIds(ids: string[]) {
    return helixFetch<{
      id: string;
      login: string;
      display_name: string;
      profile_image_url: string;
    }>("/users", { id: ids.slice(0, 100) });
  },
  /** Get Channels — usado para ler content_classification_labels (maturidade). */
  channelsByIds(broadcasterIds: string[]) {
    return helixFetch<{
      broadcaster_id: string;
      broadcaster_login: string;
      content_classification_labels: string[];
      is_branded_content?: boolean;
    }>("/channels", { broadcaster_id: broadcasterIds.slice(0, 100) });
  },
};

export interface ClipQueryOptions {
  first?: number;
  after?: string;
  /** ISO 8601 UTC */
  startedAt?: string;
  endedAt?: string;
}
