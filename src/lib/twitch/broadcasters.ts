import "server-only";
import { twitch } from "./client";

export type Broadcasters = Map<string, { login: string; avatar: string }>;

/** Login e avatar dos donos dos clipes, numa única chamada em lote. Falha → mapa vazio. */
export async function loadBroadcasters(clips: { broadcaster_id: string }[]): Promise<Broadcasters> {
  const ids = [...new Set(clips.map((c) => c.broadcaster_id))];
  if (ids.length === 0) return new Map();
  try {
    const res = await twitch.usersByIds(ids);
    return new Map(res.data.map((u) => [u.id, { login: u.login, avatar: u.profile_image_url }]));
  } catch {
    return new Map();
  }
}

export function broadcasterInfo(owners: Broadcasters, id: string) {
  const o = owners.get(id);
  return { broadcasterLogin: o?.login ?? null, broadcasterAvatar: o?.avatar ?? null };
}
