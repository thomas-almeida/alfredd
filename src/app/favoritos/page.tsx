import Link from "next/link";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  FavoriteChip,
  type FavoriteView,
} from "@/features/favorites/FavoriteChip";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Favoritos" };
export const dynamic = "force-dynamic";

interface GameJoin {
  twitch_id: string;
  name: string;
}
interface StreamerJoin {
  login: string;
  display_name: string;
}

const SUBTITLE = "Atalhos para jogos, streamers e YouTubers.";

export default async function FavoritosPage() {
  const session = await getSession();

  if (!session) {
    return (
      <AppShell crumbs={[{ label: "Favoritos" }]}>
        <PageHeader title="Favoritos" subtitle={SUBTITLE} />
        <EmptyState
          icon="star"
          title="Entre para ver seus favoritos"
          description="Faça login para favoritar jogos e criadores."
          action={
            <Link href="/entrar?next=/favoritos">
              <Button variant="primary">Entrar</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  const supabase = await createClient();
  const [{ data }, { data: ytData }] = await Promise.all([
    supabase
      .from("favorites")
      .select(
        "id, source_type, games(twitch_id, name), streamers(login, display_name)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("youtube_favorites")
      .select("id, channel_id, title")
      .order("created_at", { ascending: false }),
  ]);

  const youtubers: FavoriteView[] = (ytData ?? []).map((row) => ({
    id: row.id,
    href: `/youtube?channel=${encodeURIComponent(row.channel_id)}`,
    label: row.title,
    type: "youtuber",
  }));
  const games: FavoriteView[] = [];
  const streamers: FavoriteView[] = [];

  for (const row of data ?? []) {
    if (row.source_type === "game") {
      const g = row.games as unknown as GameJoin | null;
      if (g)
        games.push({
          id: row.id as string,
          href: `/jogos/${g.twitch_id}`,
          label: g.name,
          type: "game",
        });
    } else {
      const s = row.streamers as unknown as StreamerJoin | null;
      if (s)
        streamers.push({
          id: row.id as string,
          href: `/streamers/${s.login}`,
          label: s.display_name,
          type: "streamer",
        });
    }
  }

  const empty =
    games.length === 0 && streamers.length === 0 && youtubers.length === 0;

  return (
    <AppShell crumbs={[{ label: "Favoritos" }]}>
      <PageHeader title="Favoritos" subtitle={SUBTITLE} />
      {empty ? (
        <EmptyState
          icon="star"
          title="Nenhum favorito ainda"
          description="Favorite jogos, streamers e YouTubers para acessá-los rápido."
          action={
            <Link href="/explorar">
              <Button variant="primary">Explorar</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="text-base mb-3 flex items-center gap-2">
              Jogos{" "}
              <span className="text-xs text-subtle font-normal">
                {games.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {games.length ? (
                games.map((f) => <FavoriteChip key={f.id} fav={f} />)
              ) : (
                <span className="text-[13px] text-subtle">
                  Nenhum jogo favoritado.
                </span>
              )}
            </div>
          </section>
          <section>
            <h2 className="text-base mb-3 flex items-center gap-2">
              Streamers{" "}
              <span className="text-xs text-subtle font-normal">
                {streamers.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {streamers.length ? (
                streamers.map((f) => <FavoriteChip key={f.id} fav={f} />)
              ) : (
                <span className="text-[13px] text-subtle">
                  Nenhum streamer favoritado.
                </span>
              )}
            </div>
          </section>
          <section>
            <h2 className="text-base mb-3 flex items-center gap-2">
              YouTubers{" "}
              <span className="text-xs text-subtle font-normal">
                {youtubers.length}
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {youtubers.length ? (
                youtubers.map((f) => <FavoriteChip key={f.id} fav={f} />)
              ) : (
                <span className="text-[13px] text-subtle">
                  Nenhum YouTuber favoritado.
                </span>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
