"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { navSections } from "./nav";
import { Brand } from "./Brand";
import { removeFavorite, removeYoutubeFavorite } from "@/features/favorites/actions";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

const COLLAPSED_KEY = "sidebar_collapsed";
const COLLAPSED_WIDTH = "64px";
const STREAMERS_HIDDEN_KEY = "sidebar_streamers_hidden";
const GAMES_HIDDEN_KEY = "sidebar_games_hidden";

/** Criador favoritado (streamer da Twitch ou canal do YouTube). */
export interface SidebarCreator {
  key: string;
  favoriteId: string;
  href: string;
  name: string;
  avatar: string | null;
  platform: "twitch" | "youtube";
}

export interface SidebarGame {
  key: string;
  favoriteId: string;
  href: string;
  name: string;
  avatar: string | null;
}

export function Sidebar({
  clipCount = 0,
  creators = [],
  games = [],
}: {
  clipCount?: number;
  creators?: SidebarCreator[];
  games?: SidebarGame[];
}) {
  const pathname = usePathname();
  const selectedChannel = useSearchParams().get("channel");
  const [collapsed, setCollapsed] = useState(false);
  const [streamersHidden, setStreamersHidden] = useState(false);
  const [gamesHidden, setGamesHidden] = useState(false);
  const [removedCreators, setRemovedCreators] = useState<Set<string>>(new Set());
  const [removedGames, setRemovedGames] = useState<Set<string>>(new Set());
  const [confirmCreator, setConfirmCreator] = useState<SidebarCreator | null>(null);
  const [removing, startRemoving] = useTransition();

  // No editor a sidebar entra recolhida (sem persistir) para dar espaço aos controles.
  const inEditor = pathname.endsWith("/editor");

  useEffect(() => {
    try {
      setCollapsed(inEditor || localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {}
  }, [inEditor]);

  useEffect(() => {
    try {
      setStreamersHidden(localStorage.getItem(STREAMERS_HIDDEN_KEY) === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      setGamesHidden(localStorage.getItem(GAMES_HIDDEN_KEY) === "1");
    } catch {}
  }, []);

  function toggleStreamers() {
    setStreamersHidden((h) => {
      try {
        localStorage.setItem(STREAMERS_HIDDEN_KEY, h ? "0" : "1");
      } catch {}
      return !h;
    });
  }

  function toggleGames() {
    setGamesHidden((hidden) => {
      try {
        localStorage.setItem(GAMES_HIDDEN_KEY, hidden ? "0" : "1");
      } catch {}
      return !hidden;
    });
  }

  // A largura da coluna do grid (AppShell) acompanha a sidebar.
  useEffect(() => {
    const root = document.documentElement.style;
    if (collapsed) root.setProperty("--sidebar-w", COLLAPSED_WIDTH);
    else root.removeProperty("--sidebar-w");
  }, [collapsed]);

  function toggle() {
    setCollapsed((c) => {
      if (inEditor) return !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  function confirmRemove() {
    if (!confirmCreator) return;
    const creator = confirmCreator;
    startRemoving(async () => {
      const result = creator.platform === "youtube"
        ? await removeYoutubeFavorite(creator.favoriteId)
        : await removeFavorite(creator.favoriteId);
      if (result.ok) {
        setRemovedCreators((current) => new Set(current).add(creator.key));
        setConfirmCreator(null);
      }
    });
  }

  function removeGame(game: SidebarGame) {
    if (!window.confirm(`Remover ${game.name} dos jogos favoritos?`)) return;
    startRemoving(async () => {
      const result = await removeFavorite(game.favoriteId);
      if (result.ok) setRemovedGames((current) => new Set(current).add(game.key));
    });
  }

  return (
    <aside className={cn("[grid-area:sidebar] flex flex-col w-(--sidebar-w,var(--spacing-sidebar)) h-screen sticky top-0 border-r border-border bg-bg overflow-hidden transition-[width] duration-200", collapsed ? "p-2" : "p-4", " max-[860px]:fixed max-[860px]:z-40 max-[860px]:-translate-x-full")}>
      <div className={cn("flex items-center gap-2 pt-2 pb-6", collapsed ? "flex-col px-0" : "px-2")}>
        <Brand collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "inline-flex items-center justify-center w-7 h-7 rounded-sm text-muted hover:bg-surface-2 hover:text-fg",
            !collapsed && "ml-auto",
          )}
          aria-label={collapsed ? "Expandir menu" : "Minimizar menu"}
          title={collapsed ? "Expandir menu" : "Minimizar menu"}
          aria-expanded={!collapsed}
        >
          <Icon name="chevron-right" className={cn("transition-transform", !collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="flex flex-col gap-6 flex-1 overflow-y-auto">
        {navSections.map((section, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            {section.title && !collapsed && (
              <div className="text-xs uppercase tracking-wider text-subtle px-2 pt-2 pb-1">
                {section.title}
              </div>
            )}
            {section.items.filter((item) => item.href !== "/favoritos").map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 py-2 rounded-sm",
                    collapsed ? "justify-center px-0" : "px-2",
                    " text-[13px] font-medium transition-colors",
                    active
                      ? "bg-surface-hover text-fg"
                      : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  {item.platformLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/${item.platformLogo}.svg`}
                      alt=""
                      width={18}
                      height={18}
                      className="shrink-0 object-contain"
                    />
                  ) : (
                    <Icon name={item.icon} className="shrink-0 opacity-90" />
                  )}
                  {!collapsed && <span>{item.label}</span>}
                  {item.href === "/biblioteca" && clipCount > 0 && !collapsed && (
                    <span className="ml-auto min-w-5 px-1.5 py-px rounded-full bg-surface-2 text-[0.6875rem] font-semibold text-muted text-center tabular-nums">
                      {clipCount}
                    </span>
                  )}
                  {item.pro && !collapsed && (
                    <span className="ml-auto text-[0.625rem] font-bold tracking-wide text-accent">
                      PRO
                    </span>
                  )}
                </Link>
              );
            })}
            {section.items.some((item) => item.href === "/favoritos") && (
          <div className="flex flex-col gap-0.5 mt-1">
            {!collapsed && (
              <button
                type="button"
                onClick={toggleStreamers}
                className="flex items-center gap-1 text-xs uppercase tracking-wider text-subtle px-2 pt-2 pb-1 hover:text-fg"
                aria-expanded={!streamersHidden}
              >
                Criadores favoritos
                <span className="normal-case tracking-normal">({creators.length})</span>
                <Icon
                  name="chevron-right"
                  width={14}
                  height={14}
                  className={cn("ml-auto transition-transform", !streamersHidden && "rotate-90")}
                />
              </button>
            )}
            {(collapsed || !streamersHidden) &&
              creators.filter((s) => !removedCreators.has(s.key)).map((s) => {
                const youtube = s.platform === "youtube";
                const active = youtube
                  ? pathname === "/youtube" && selectedChannel === s.key.slice("youtube:".length)
                  : isActive(pathname, s.href);
                const className = cn(
                  "flex items-center gap-3 py-1.5 rounded-sm text-[13px] font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "px-2",
                  active
                    ? "bg-surface-hover text-fg"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                );
                const platformLabel = youtube ? "YouTube" : "Twitch";
                const content = (
                  <>
                    <span className="relative shrink-0">
                      {s.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.avatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-surface-2 text-[0.625rem] font-bold flex items-center justify-center">
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/${youtube ? "youtube" : "twitch"}.svg`}
                        alt=""
                        width={14}
                        height={14}
                        className="absolute -right-1.5 -bottom-1.5 h-[14px] w-[14px] rounded-full bg-bg p-px object-contain"
                        aria-hidden
                      />
                    </span>
                    {!collapsed && <span className="truncate">{s.name}</span>}
                    <span className="sr-only">({platformLabel})</span>
                  </>
                );
                const title = `${s.name} · ${platformLabel}`;
                const item = youtube ? (
                  <Link
                    key={s.key}
                    href={s.href}
                    className={className}
                    aria-current={active ? "page" : undefined}
                    title={title}
                  >
                    {content}
                  </Link>
                ) : (
                  <Link
                    key={s.key}
                    href={s.href}
                    className={className}
                    aria-current={active ? "page" : undefined}
                    title={title}
                  >
                    {content}
                  </Link>
                );
                return <div key={s.key} className="group relative">
                  {item}
                  {!collapsed && <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmCreator(s); }} className="absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-danger hover:text-white group-hover:opacity-100" aria-label={`Desfavoritar ${s.name}`} title="Desfavoritar">
                    −
                  </button>}
                </div>;
              })}
            {!collapsed && !streamersHidden && (
              <Link
                href="/favoritos"
                className="px-2 py-1 text-xs text-subtle hover:text-fg"
              >
                {creators.length ? "Ver todos os favoritos" : "Nenhum criador favoritado"}
              </Link>
            )}
            {!collapsed && games.length > 0 && (
              <div className="mt-3 border-t border-border pt-2">
                <button type="button" onClick={toggleGames} className="flex w-full items-center gap-1 px-2 pt-1 pb-1 text-left text-xs uppercase tracking-wider text-subtle hover:text-fg" aria-expanded={!gamesHidden}>
                  Jogos favoritos ({games.length})
                  <Icon name="chevron-right" width={14} height={14} className={cn("ml-auto transition-transform", !gamesHidden && "rotate-90")} />
                </button>
                {!gamesHidden && games.filter((game) => !removedGames.has(game.key)).map((game) => {
                  const active = isActive(pathname, game.href);
                  return (
                    <div key={game.key} className="group relative">
                      <Link href={game.href} className={cn("flex items-center gap-3 py-1.5 rounded-sm text-[13px] font-medium transition-colors px-2", active ? "bg-surface-hover text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")} aria-current={active ? "page" : undefined}>
                        {game.avatar ? <Image src={game.avatar} alt="" width={20} height={20} className="w-5 h-5 rounded-sm object-cover" /> : <span className="w-5 h-5 rounded-sm bg-surface-2 text-[0.625rem] font-bold flex items-center justify-center">{game.name.charAt(0).toUpperCase()}</span>}
                        <span className="truncate">{game.name}</span>
                      </Link>
                      <button type="button" onClick={() => removeGame(game)} className="absolute right-1 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-danger hover:text-white group-hover:opacity-100" aria-label={`Desfavoritar ${game.name}`} title="Desfavoritar">−</button>
                    </div>
                  );
                })}
                {!gamesHidden && <Link href="/favoritos" className="block px-2 py-1 text-xs text-subtle hover:text-fg">Ver todos os favoritos</Link>}
              </div>
            )}
            {collapsed && games.filter((game) => !removedGames.has(game.key)).map((game) => (
              <Link key={game.key} href={game.href} className={cn("flex items-center justify-center py-1.5 rounded-sm", isActive(pathname, game.href) ? "bg-surface-hover" : "hover:bg-surface-2")} title={game.name}>
                {game.avatar ? <Image src={game.avatar} alt="" width={20} height={20} className="w-5 h-5 rounded-sm object-cover" /> : <span className="w-5 h-5 rounded-sm bg-surface-2 text-[0.625rem] font-bold flex items-center justify-center">{game.name.charAt(0).toUpperCase()}</span>}
              </Link>
            ))}
          </div>
            )}
          </div>
        ))}

      </nav>
      {confirmCreator && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="unfavorite-title" onClick={() => !removing && setConfirmCreator(null)}>
        <div className="w-full max-w-sm rounded-lg border border-border-strong bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            {confirmCreator.avatar ? <Image src={confirmCreator.avatar} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-lg font-bold">{confirmCreator.name.charAt(0).toUpperCase()}</span>}
            <div><h2 id="unfavorite-title" className="font-semibold">Desfavoritar criador?</h2><p className="text-xs text-muted">{confirmCreator.name}</p></div>
          </div>
          <p className="mt-4 text-sm text-muted">Você deixará de seguir este criador na sua lista de favoritos. No plano Free, o espaço usado não será devolvido.</p>
          <div className="mt-5 flex justify-end gap-2"><button type="button" className="rounded px-3 py-2 text-sm text-muted hover:bg-surface-2" disabled={removing} onClick={() => setConfirmCreator(null)}>Cancelar</button><button type="button" className="rounded bg-danger px-3 py-2 text-sm font-semibold text-white hover:brightness-110" disabled={removing} onClick={confirmRemove}>{removing ? "Removendo…" : "Desfavoritar"}</button></div>
        </div>
      </div>}
    </aside>
  );
}
