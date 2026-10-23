"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { navSections } from "./nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

const COLLAPSED_KEY = "sidebar_collapsed";
const COLLAPSED_WIDTH = "64px";
const STREAMERS_HIDDEN_KEY = "sidebar_streamers_hidden";

export interface SidebarStreamer {
  login: string;
  name: string;
  avatar: string | null;
}

export function Sidebar({
  clipCount = 0,
  streamers = [],
}: {
  clipCount?: number;
  streamers?: SidebarStreamer[];
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [streamersHidden, setStreamersHidden] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
      setStreamersHidden(localStorage.getItem(STREAMERS_HIDDEN_KEY) === "1");
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

  // A largura da coluna do grid (AppShell) acompanha a sidebar.
  useEffect(() => {
    const root = document.documentElement.style;
    if (collapsed) root.setProperty("--sidebar-w", COLLAPSED_WIDTH);
    else root.removeProperty("--sidebar-w");
  }, [collapsed]);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  return (
    <aside className={cn("[grid-area:sidebar] flex flex-col w-(--sidebar-w,var(--spacing-sidebar)) h-screen sticky top-0 border-r border-border bg-bg overflow-hidden transition-[width] duration-200", collapsed ? "p-2" : "p-4", " max-[860px]:fixed max-[860px]:z-40 max-[860px]:-translate-x-full")}>
      <div className={cn("flex items-center gap-2 pt-2 pb-6", collapsed ? "flex-col px-0" : "px-2")}>
        <span className="inline-flex items-center justify-center w-7 h-7 shrink-0 rounded-sm bg-accent text-accent-fg">
          <Icon name="film" width={18} height={18} />
        </span>
        {!collapsed && <span className="text-base font-bold tracking-tight">Clipes</span>}
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
                  <Icon name={item.icon} className="shrink-0 opacity-90" />
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
                Streamers favoritos
                <span className="normal-case tracking-normal">({streamers.length})</span>
                <Icon
                  name="chevron-right"
                  width={14}
                  height={14}
                  className={cn("ml-auto transition-transform", !streamersHidden && "rotate-90")}
                />
              </button>
            )}
            {(collapsed || !streamersHidden) &&
              streamers.map((s) => {
                const href = `/streamers/${s.login}`;
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={s.login}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 py-1.5 rounded-sm text-[13px] font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "px-2",
                      active
                        ? "bg-surface-hover text-fg"
                        : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? s.name : undefined}
                  >
                    {s.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.avatar} alt="" className="w-5 h-5 rounded-full shrink-0 object-cover" />
                    ) : (
                      <span className="w-5 h-5 rounded-full shrink-0 bg-surface-2 text-[0.625rem] font-bold flex items-center justify-center">
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {!collapsed && <span className="truncate">{s.name}</span>}
                  </Link>
                );
              })}
            {!collapsed && !streamersHidden && (
              <Link
                href="/favoritos"
                className="px-2 py-1 text-xs text-subtle hover:text-fg"
              >
                {streamers.length ? "Ver todos os favoritos" : "Nenhum streamer favoritado"}
              </Link>
            )}
          </div>
            )}
          </div>
        ))}

      </nav>
      <div className={cn("pt-4", collapsed && "hidden")}>
        <Link
          href="/assinatura"
          className="block p-3 border border-border rounded-md bg-surface hover:border-border-strong"
        >
          <div className="text-[13px] font-semibold">Plano Free</div>
          <div className="text-xs text-subtle mt-0.5">
            3 jogos · 3 streamers · 5 clipes
          </div>
          <span className="inline-block mt-2 text-xs font-semibold text-accent">
            Conhecer o PRO
          </span>
        </Link>
      </div>
    </aside>
  );
}
