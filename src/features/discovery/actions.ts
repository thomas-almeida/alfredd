"use server";

import { twitch } from "@/lib/twitch/client";
import { loadBroadcasters, broadcasterInfo } from "@/lib/twitch/broadcasters";
import type { ClipCardData } from "@/features/clips/ClipCard";

/** Dados de um clipe da Twitch pelo slug, para abrir o preview a partir de um link colado. */
export async function lookupClip(slug: string): Promise<ClipCardData | null> {
  if (!/^[\w-]{1,120}$/.test(slug)) return null;
  try {
    const res = await twitch.clipsByIds([slug]);
    const c = res.data[0];
    if (!c) return null;
    const owners = await loadBroadcasters([c]);
    return {
      twitchId: c.id,
      title: c.title,
      broadcasterName: c.broadcaster_name,
      ...broadcasterInfo(owners, c.broadcaster_id),
      thumbnailUrl: c.thumbnail_url,
      viewCount: c.view_count,
      durationSeconds: c.duration,
      createdAt: c.created_at,
      url: c.url,
    };
  } catch {
    return null;
  }
}
