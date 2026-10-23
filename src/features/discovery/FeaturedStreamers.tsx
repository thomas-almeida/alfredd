import Link from "next/link";
import { twitch } from "@/lib/twitch/client";
import { RecommendedClips } from "@/features/clips/RecommendedClips";
import type { ClipCardData } from "@/features/clips/ClipCard";

/** Clipes mais recentes por canal exibidos abaixo dos logos. */
const CLIPS_PER_CHANNEL = 3;

/** Streamers fixados na home: atalho para a página de clipes de cada canal. */
const STREAMERS = [
  { login: "alanzoka", tag: "Variedades", color: "#9147ff" },
  { login: "flowpodcast", tag: "Just Chatting", color: "#f5a623" },
  { login: "gaules", tag: "CS2 · Tribo", color: "#f5a623" },
  { login: "kaicenat", tag: "Just Chatting", color: "#5b9dff" },
  { login: "coringa", tag: "Free Fire · IRL", color: "#b4f34a" },
  { login: "frttt", tag: "Free Fire · IRL", color: "#b4f34a" },

];

type Streamer = { id: string; login: string; name: string; avatar: string };

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
  const clips = await loadRecentClips([...users.values()]);

  return (
    <section className="mt-4 mx-auto max-w-[1080px]">
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold">Streamers em destaque</h2>
        <p className="text-muted text-[13px] mt-2">
          Clique e veja os melhores clipes do canal.
        </p>
      </div>
      <div className="flex justify-center items-center -space-x-4">
        {STREAMERS.map((s) => {
          const u = users.get(s.login);
          const name = u?.name ?? s.login;
          return (
            <Link
              key={s.login}
              href={`/streamers/${s.login}`}
              aria-label={name}
              className="group relative hover:z-10 focus-visible:z-10"
            >
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-surface-2 border border-border px-2.5 py-1 text-xs font-semibold shadow-lg opacity-0 transition duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0"
              >
                {name}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
              </span>
              <div className="flex justify-center">
                <div className="">
                  {u?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.avatar}
                      alt=""
                      className="relative w-30 h-30 rounded-lg object-cover border-[3px] border-surface transition-transform duration-300 group-hover:scale-105 shadow-xl hover:scale-110"
                    />
                  ) : (
                    <div className="relative w-30 h-30 rounded-lg bg-surface-2 border-[3px] border-surface flex items-center justify-center text-2xl font-bold">
                      {name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
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
