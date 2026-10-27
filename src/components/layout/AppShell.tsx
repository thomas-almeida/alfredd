import type { ReactNode, CSSProperties } from "react";
import { Sidebar, type SidebarCreator, type SidebarGame } from "./Sidebar";
import { TopBar, type Crumb } from "./TopBar";
import { AuthModalProvider } from "@/features/auth/AuthModal";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const authedGrid: CSSProperties = {
  gridTemplateColumns: "var(--sidebar-w, var(--spacing-sidebar)) 1fr",
  gridTemplateRows: "var(--spacing-topbar) 1fr",
  gridTemplateAreas: '"sidebar topbar" "sidebar main"',
};

const publicGrid: CSSProperties = {
  gridTemplateColumns: "1fr",
  gridTemplateRows: "var(--spacing-topbar) 1fr",
  gridTemplateAreas: '"topbar" "main"',
};

export async function AppShell({
  crumbs,
  children,
  wide = false,
}: {
  crumbs?: Crumb[];
  children: ReactNode;
  wide?: boolean;
}) {
  const session = await getSession();
  const authed = Boolean(session);

  let clipCount = 0;
  let favCreators: SidebarCreator[] = [];
  let favGames: SidebarGame[] = [];
  if (session) {
    const supabase = await createClient();
    const [lib, savedYoutubes, savedVods, favs, ytFavs, gameFavs] = await Promise.all([
      supabase.from("library_items").select("id", { count: "exact", head: true }),
      supabase.from("youtube_saved_videos").select("id", { count: "exact", head: true }),
      supabase.from("twitch_saved_vods").select("id", { count: "exact", head: true }),
      supabase
        .from("favorites")
        .select("id, created_at, streamers(login, display_name, thumbnail_url)")
        .eq("source_type", "streamer")
        .order("created_at", { ascending: false }),
      supabase
        .from("youtube_favorites")
        .select("id, channel_id, title, thumbnail_url, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("favorites")
        .select("id, created_at, games(twitch_id, name, box_art_url)")
        .eq("source_type", "game")
        .order("created_at", { ascending: false }),
    ]);
    clipCount = (lib.count ?? 0) + (savedYoutubes.count ?? 0) + (savedVods.count ?? 0);
    const twitch = (favs.data ?? []).flatMap((row) => {
      const s = row.streamers as unknown as {
        login: string;
        display_name: string;
        thumbnail_url: string | null;
      } | null;
      return s
        ? [
            {
              key: `twitch:${s.login}`,
              favoriteId: row.id,
              href: `/streamers/${s.login}`,
              name: s.display_name,
              avatar: s.thumbnail_url,
              platform: "twitch" as const,
              createdAt: row.created_at,
            },
          ]
        : [];
    });
    const youtube = (ytFavs.data ?? []).map((row) => ({
      key: `youtube:${row.channel_id}`,
      favoriteId: row.id,
      href: `/youtube?channel=${encodeURIComponent(row.channel_id)}`,
      name: row.title,
      avatar: row.thumbnail_url,
      platform: "youtube" as const,
      createdAt: row.created_at,
    }));
    // Streamers e YouTubers convivem numa lista só, do mais recente ao mais antigo.
    favCreators = [...twitch, ...youtube]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ createdAt: _, ...c }) => c);
    favGames = (gameFavs.data ?? []).flatMap((row) => {
      const game = row.games as unknown as { twitch_id: string; name: string; box_art_url: string | null } | null;
      return game ? [{ key: `game:${game.twitch_id}`, favoriteId: row.id, href: `/jogos/${game.twitch_id}`, name: game.name, avatar: game.box_art_url }] : [];
    });
  }

  return (
    <AuthModalProvider>
      <div
        className="grid min-h-screen max-[860px]:[grid-template-columns:1fr!important] max-[860px]:[grid-template-areas:'topbar'_'main']"
        style={authed ? authedGrid : publicGrid}
      >
        {authed && <Sidebar clipCount={clipCount} creators={favCreators} games={favGames} />}
        <TopBar crumbs={crumbs} email={session?.email ?? null} showBrand={!authed} />
        <main
          className={
            authed
              ? wide
                ? "[grid-area:main] min-w-0 w-full max-w-none overflow-x-hidden p-3 max-[860px]:p-4"
                : "[grid-area:main] min-w-0 overflow-x-hidden p-6 max-w-[1400px] w-full mx-auto max-[860px]:p-4"
              : "[grid-area:main] min-w-0 overflow-x-hidden p-6 w-full max-w-[1120px] mx-auto max-[860px]:p-4"
          }
        >
          {children}
        </main>
      </div>
    </AuthModalProvider>
  );
}

/** Cabeçalho de página: título, subtítulo, badges e ações. */
export function PageHeader({
  title,
  subtitle,
  badges,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        {badges && <div className="flex gap-2 mb-3">{badges}</div>}
        <h1 className="text-[2.25rem] font-bold">{title}</h1>
        {subtitle && (
          <p className="text-muted mt-2 max-w-[64ch]">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
