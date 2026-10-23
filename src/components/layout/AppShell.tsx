import type { ReactNode, CSSProperties } from "react";
import { Sidebar, type SidebarStreamer } from "./Sidebar";
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
}: {
  crumbs?: Crumb[];
  children: ReactNode;
}) {
  const session = await getSession();
  const authed = Boolean(session);

  let clipCount = 0;
  let favStreamers: SidebarStreamer[] = [];
  if (session) {
    const supabase = await createClient();
    const [lib, favs] = await Promise.all([
      supabase.from("library_items").select("id", { count: "exact", head: true }),
      supabase
        .from("favorites")
        .select("id, streamers(login, display_name, thumbnail_url)")
        .eq("source_type", "streamer")
        .order("created_at", { ascending: false }),
    ]);
    clipCount = lib.count ?? 0;
    favStreamers = (favs.data ?? []).flatMap((row) => {
      const s = row.streamers as unknown as {
        login: string;
        display_name: string;
        thumbnail_url: string | null;
      } | null;
      return s
        ? [{ login: s.login, name: s.display_name, avatar: s.thumbnail_url }]
        : [];
    });
  }

  return (
    <AuthModalProvider>
      <div
        className="grid min-h-screen max-[860px]:[grid-template-columns:1fr!important] max-[860px]:[grid-template-areas:'topbar'_'main']"
        style={authed ? authedGrid : publicGrid}
      >
        {authed && <Sidebar clipCount={clipCount} streamers={favStreamers} />}
        <TopBar
          crumbs={crumbs}
          email={session?.email ?? null}
          publicNav={!authed}
        />
        <main
          className={
            authed
              ? "[grid-area:main] p-6 max-w-[1400px] w-full mx-auto max-[860px]:p-4"
              : "[grid-area:main] p-6 w-full max-w-[1120px] mx-auto max-[860px]:p-4"
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
