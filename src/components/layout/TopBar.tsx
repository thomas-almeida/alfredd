import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { TopBarAuth } from "./TopBarAuth";
import { GlobalSearch } from "./GlobalSearch";

export interface Crumb {
  label: string;
  href?: string;
}

export function TopBar({
  crumbs = [],
  email = null,
  publicNav = false,
}: {
  crumbs?: Crumb[];
  email?: string | null;
  publicNav?: boolean;
}) {
  return (
    <header className="[grid-area:topbar] sticky top-0 z-20 flex items-center justify-between gap-4 h-(--spacing-topbar) px-6 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold text-[13px]">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-sm bg-surface-2 border border-border-strong">
            <Icon name="film" width={14} height={14} />
          </span>
          Clipes
        </Link>
        <Badge tone="accent">Beta</Badge>

        {publicNav && (
          <Link
            href="/explorar"
            className="text-[13px] font-medium text-muted px-3 py-2 rounded-sm hover:bg-surface-2 hover:text-fg"
          >
            Explorar
          </Link>
        )}

        {crumbs.length > 0 && <span className="text-subtle">/</span>}
        <nav
          className="flex items-center gap-1 min-w-0 overflow-hidden max-[640px]:hidden"
          aria-label="Trilha de navegação"
        >
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[13px] text-muted whitespace-nowrap"
              >
                {c.href && !last ? (
                  <Link href={c.href} className="hover:text-fg">
                    {c.label}
                  </Link>
                ) : (
                  <span className={cn(last && "text-fg font-medium")}>
                    {c.label}
                  </span>
                )}
                {!last && (
                  <Icon
                    name="chevron-right"
                    width={14}
                    height={14}
                    className="text-subtle"
                  />
                )}
              </span>
            );
          })}
        </nav>
      </div>

      <GlobalSearch />

      <div className="flex items-center gap-3 min-w-0">
        <TopBarAuth email={email} />
      </div>
    </header>
  );
}
