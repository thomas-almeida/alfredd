import { twitch } from "@/lib/twitch/client";
import { yt, type YtChannel } from "@/lib/youtube/api";
import { RecommendedClips } from "@/features/clips/RecommendedClips";
import { FeaturedCreatorCarousel, type FeaturedCarouselCreator } from "./FeaturedCreatorCarousel";
import type { ClipCardData } from "@/features/clips/ClipCard";

/** Clipes mais recentes por canal exibidos abaixo dos logos. */
const CLIPS_PER_CHANNEL = 3;

/** Streamers fixados na home: atalho para a página de clipes de cada canal. */
const STREAMERS = [
  { login: "alanzoka", tag: "Variedades", color: "#9147ff" },
  { login: "kaicenat", tag: "Just Chatting", color: "#5b9dff" },
  { login: "coringa", tag: "Free Fire · IRL", color: "#b4f34a" },
  { login: "frttt", tag: "Free Fire · IRL", color: "#b4f34a" },
  { login: "coreano", tag: "Free Fire · IRL", color: "#b4f34a" },
  { login: "yoda", tag: "Free Fire · IRL", color: "#b4f34a" },
  { login: "brino", tag: "Free Fire · IRL", color: "#b4f34a" },
  { login: "gaules", tag: "Free Fire · IRL", color: "#b4f34a" }
];

type Streamer = { id: string; login: string; name: string; avatar: string };
type FeaturedCreator = FeaturedCarouselCreator;

async function loadUsers(): Promise<Map<string, Streamer>> {
  try {
    const res = await twitch.usersByLogin(STREAMERS.map((s) => s.login));
    return new Map(
      res.data.map((u) => [
        u.login,
        { id: u.id, login: u.login, name: u.display_name, avatar: u.profile_image_url },
      ]),
    );
  } catch {
    return new Map();
  }
}

async function loadYouTubeChannels(): Promise<FeaturedCreator[]> {
  const handles = ["podpah", "einerdtv", "brksedu", "funkyblackcat", "peteraqui", "gameplayrj", "mrbeast", "einerd", "hayashixpg"];
  try {
    const channels = await Promise.all(
      handles.map(async (handle) => {
        try {
          const result = await yt<{ items: YtChannel[] }>("channels", {
            part: "snippet",
            forHandle: `@${handle}`,
          });
          const channel = result.items?.[0];
          if (!channel) return null;
          const thumbnails = channel.snippet.thumbnails;
          return {
            key: `youtube:${channel.id}`,
            name: channel.snippet.title,
            avatar: thumbnails?.high?.url ?? thumbnails?.medium?.url ?? thumbnails?.default?.url ?? null,
            platform: "youtube" as const,
            href: `/youtube?channel=${encodeURIComponent(channel.id)}`,
          };
        } catch {
          return null;
        }
      }),
    );
    return channels.filter((channel): channel is NonNullable<typeof channel> => channel !== null);
  } catch {
    return [];
  }
}

/**
 * A Helix ordena clipes por views, não por data: pega os da última semana e
 * ordena por created_at. Canal que falhar fica de fora, sem derrubar a seção.
 */
async function loadRecentClips(users: Streamer[]): Promise<ClipCardData[]> {
  const startedAt = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const perChannel = await Promise.all(
    users.map(async (u) => {
      try {
        const res = await twitch.clipsByBroadcaster(u.id, { first: 50, startedAt });
        return res.data
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, CLIPS_PER_CHANNEL)
          .map<ClipCardData>((c) => ({
            twitchId: c.id,
            title: c.title,
            broadcasterName: c.broadcaster_name,
            broadcasterLogin: u.login,
            broadcasterAvatar: u.avatar,
            thumbnailUrl: c.thumbnail_url,
            viewCount: c.view_count,
            durationSeconds: c.duration,
            createdAt: c.created_at,
            score: { value: null, status: "insuficiente" as const },
          }));
      } catch {
        return [];
      }
    }),
  );
  return perChannel.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function FeaturedStreamers() {
  const users = await loadUsers();
  const youtubeChannels = await loadYouTubeChannels();
  const clips = await loadRecentClips([...users.values()]);
  const creators: FeaturedCreator[] = [
    ...STREAMERS.map((streamer) => {
      const user = users.get(streamer.login);
      return {
        key: `twitch:${streamer.login}`,
        name: user?.name ?? streamer.login,
        avatar: user?.avatar ?? null,
        platform: "twitch" as const,
        href: `/streamers/${streamer.login}`,
      };
    }),
    ...youtubeChannels,
  ];
  const rows = [
    creators.filter((_, index) => index % 2 === 0),
    creators.filter((_, index) => index % 2 === 1),
  ];

  return (
    <section className="relative mt-4 w-full max-w-full overflow-hidden">
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold">Criadores em Destaque</h2>
        <p className="text-muted text-[13px] mt-2">
          Descubra canais da Twitch e do YouTube para encontrar o próximo corte.
        </p>
      </div>
      <FeaturedCreatorCarousel rows={rows} />
      {clips.length > 0 && (
        <div className="mt-8 text-center">
          <div className="py-8">
            <h2 className="text-2xl font-bold">Para Clipar Agora</h2>
            <p className="text-muted text-[13px] mt-2">
              Clipes mais vistos da semana. Clique para assistir e salve para
              editar depois.
            </p>
          </div>
          <RecommendedClips clips={clips} trending={false} />
        </div>
      )}
    </section>
  );
}
