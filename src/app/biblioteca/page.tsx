import { QUOTAS } from "@/lib/permissions/quotas";
import Link from "next/link";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  LibraryItemCard,
  type LibraryItemView,
} from "@/features/library/LibraryItemCard";
import { LibraryFilters, type StreamerOption } from "@/features/library/LibraryFilters";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { twitch } from "@/lib/twitch/client";
import { loadBroadcasters } from "@/lib/twitch/broadcasters";

export const metadata = { title: "Biblioteca" };
export const dynamic = "force-dynamic";

interface ClipJoin {
  twitch_id: string;
  title: string | null;
  thumbnail_url: string | null;
  latest_view_count: number | null;
  twitch_created_at: string;
  url: string;
  streamers: { login: string; display_name: string; thumbnail_url: string | null } | null;
  games: { name: string } | null;
}

export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ streamer?: string; jogo?: string }>;
}) {
  const { streamer = "", jogo = "" } = await searchParams;
  const session = await getSession();

  if (!session) {
    return (
      <AppShell crumbs={[{ label: "Biblioteca" }]}>
        <PageHeader title="Biblioteca" subtitle="Seus clipes salvos." />
        <EmptyState
          icon="bookmark"
          title="Entre para ver sua biblioteca"
          description="Faça login para salvar e organizar clipes."
          action={
            <Link href="/entrar?next=/biblioteca">
              <Button variant="primary">Entrar</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("library_items")
    .select(
      "id, clips(twitch_id, title, thumbnail_url, latest_view_count, twitch_created_at, url, streamers(login, display_name, thumbnail_url), games(name))",
    )
    .order("created_at", { ascending: false });

  const items: LibraryItemView[] = (data ?? [])
    .map((row) => {
      const clip = row.clips as unknown as ClipJoin | null;
      if (!clip) return null;
      return {
        id: row.id as string,
        twitchId: clip.twitch_id,
        title: clip.title,
        thumbnailUrl: clip.thumbnail_url,
        viewCount: clip.latest_view_count,
        createdAt: clip.twitch_created_at,
        officialUrl: clip.url,
        broadcasterName: clip.streamers?.display_name ?? null,
        broadcasterLogin: clip.streamers?.login ?? null,
        broadcasterAvatar: clip.streamers?.thumbnail_url ?? null,
        gameName: clip.games?.name ?? null,
      } satisfies LibraryItemView;
    })
    .filter((x): x is LibraryItemView => x !== null);

  // Clipes salvos sem streamer no catálogo: completa nome e avatar pela Twitch.
  const missing = items.filter((i) => !i.broadcasterName).map((i) => i.twitchId);
  if (missing.length > 0) {
    try {
      const res = await twitch.clipsByIds(missing.slice(0, 100));
      const owners = await loadBroadcasters(res.data);
      const byClip = new Map(res.data.map((c) => [c.id, c]));
      for (const item of items) {
        const c = byClip.get(item.twitchId);
        if (!c || item.broadcasterName) continue;
        const o = owners.get(c.broadcaster_id);
        item.broadcasterName = c.broadcaster_name;
        item.broadcasterLogin = o?.login ?? null;
        item.broadcasterAvatar = o?.avatar ?? null;
      }
    } catch {
      /* sem dados da Twitch: segue sem streamer */
    }
  }

  // Opções vêm da biblioteca inteira; o filtro só afeta a grade.
  const streamerMap = new Map<string, StreamerOption>();
  for (const i of items)
    if (i.broadcasterName && !streamerMap.has(i.broadcasterName))
      streamerMap.set(i.broadcasterName, { name: i.broadcasterName, avatar: i.broadcasterAvatar });
  const streamers = [...streamerMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const games = [...new Set(items.map((i) => i.gameName).filter((g): g is string => !!g))].sort((a, b) =>
    a.localeCompare(b),
  );
  const visible = items.filter(
    (i) => (!streamer || i.broadcasterName === streamer) && (!jogo || i.gameName === jogo),
  );

  return (
    <AppShell crumbs={[{ label: "Biblioteca" }]}>
      <PageHeader
        title="Biblioteca"
        subtitle={
          session.isPro
            ? "Seus clipes salvos (plano PRO, sem limite artificial)."
            : `Seus clipes salvos. Plano Free: ${items.length}/${QUOTAS.free.savedClips} clipes (sem remoção).`
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Sua biblioteca está vazia"
          description="Ao salvar um clipe, ele aparece aqui com link oficial e atalho para o editor."
          action={
            <Link href="/explorar">
              <Button variant="primary">Explorar clipes</Button>
            </Link>
          }
        />
      ) : (
        <>
          <LibraryFilters
            key={`${streamer}|${jogo}`}
            streamers={streamers}
            games={games}
            streamer={streamer}
            game={jogo}
          />
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Nenhum clipe com esses filtros.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {visible.map((item) => (
                <LibraryItemCard key={item.id} item={item} isPro={session.isPro} />
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
