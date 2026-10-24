"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { removeFavorite, removeYoutubeFavorite } from "./actions";

export interface FavoriteView {
  id: string;
  href: string;
  label: string;
  type: "game" | "streamer" | "youtuber";
}

const DOT: Record<FavoriteView["type"], string> = {
  game: "bg-accent",
  streamer: "bg-info",
  youtuber: "bg-danger",
};

export function FavoriteChip({ fav }: { fav: FavoriteView }) {
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  const remove =
    fav.type === "youtuber" ? removeYoutubeFavorite : removeFavorite;
  const external = fav.href.startsWith("http");
  const linkClass = "text-[13px] font-medium hover:text-accent";

  return (
    <div className="inline-flex items-center gap-2 pl-3 pr-2 py-2 border border-border rounded-full bg-surface">
      <span className={cn("w-2 h-2 rounded-full", DOT[fav.type])} aria-hidden />
      {external ? (
        <a
          href={fav.href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          {fav.label}
        </a>
      ) : (
        <Link href={fav.href} className={linkClass}>
          {fav.label}
        </Link>
      )}
      <button
        type="button"
        className="w-5 h-5 rounded-full border-none bg-surface-2 text-muted text-[15px] leading-none inline-flex items-center justify-center hover:bg-danger hover:text-white"
        disabled={pending}
        aria-label={`Remover ${fav.label}`}
        onClick={() =>
          start(() =>
            remove(fav.id).then((r) => {
              if (r.ok) setRemoved(true);
            }),
          )
        }
      >
        ×
      </button>
    </div>
  );
}
