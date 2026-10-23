import "server-only";
import { twitch } from "./client";
import { loadBroadcasters, broadcasterInfo } from "./broadcasters";
import type { ClipCardData } from "@/features/clips/ClipCard";

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/**
 * Clipes em alta para a vitrine da home. Busca categorias populares (foco em
 * GTA, público-alvo do produto) e retorna os clipes mais vistos da semana.
 * A API de clips já ordena por views (desc). Falhas degradam para lista vazia.
 */
export async function getRecommendedClips(limit = 8): Promise<ClipCardData[]> {
  const candidates = ["Grand Theft Auto VI", "Grand Theft Auto V", "Just Chatting"];

  try {
    for (const name of candidates) {
      const cats = await twitch.searchCategories(name, 1);
      const cat = cats.data[0];
      if (!cat) continue;

      const clipsRes = await twitch.clipsByGame(cat.id, {
        first: limit,
        startedAt: daysAgoISO(7),
      });
      if (clipsRes.data.length === 0) continue;

      const clips = clipsRes.data.slice(0, limit);

      // Detecta maturidade dos canais em uma única chamada em lote.
      const mature = new Set<string>();
      const broadcasterIds = [...new Set(clips.map((c) => c.broadcaster_id))];
      try {
        const channels = await twitch.channelsByIds(broadcasterIds);
        for (const ch of channels.data) {
          if ((ch.content_classification_labels ?? []).length > 0) {
            mature.add(ch.broadcaster_id);
          }
        }
      } catch {
        // Sem a info, assume não-mature (o embed mostra o gate se for o caso).
      }

      const owners = await loadBroadcasters(clips);
      return clips.map((c) => ({
        twitchId: c.id,
        title: c.title,
        broadcasterName: c.broadcaster_name,
        ...broadcasterInfo(owners, c.broadcaster_id),
        thumbnailUrl: c.thumbnail_url,
        viewCount: c.view_count,
        durationSeconds: c.duration,
        createdAt: c.created_at,
        url: c.url,
        isMature: mature.has(c.broadcaster_id),
        score: { value: null, status: "insuficiente" as const },
      }));
    }
    return [];
  } catch {
    return [];
  }
}
