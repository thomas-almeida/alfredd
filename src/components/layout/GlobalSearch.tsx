"use client";

import { usePathname } from "next/navigation";
import { SearchBox } from "@/features/discovery/SearchBox";

/** Busca global da barra do topo; na home a busca fica no hero. */
export function GlobalSearch() {
  if (usePathname() === "/") return null;
  return (
    <div className="flex-1 flex justify-center min-w-0 max-w-[420px] max-[640px]:hidden">
      <SearchBox size="sm" />
    </div>
  );
}
