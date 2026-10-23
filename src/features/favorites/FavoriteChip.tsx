"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { removeFavorite } from "./actions";

export interface FavoriteView {
  id: string;
  href: string;
  label: string;
  type: "game" | "streamer";
}

export function FavoriteChip({ fav }: { fav: FavoriteView }) {
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  return (
    <div className="inline-flex items-center gap-2 pl-3 pr-2 py-2 border border-border rounded-full bg-surface">
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          fav.type === "streamer" ? "bg-info" : "bg-accent",
        )}
        aria-hidden
      />
      <Link href={fav.href} className="text-[13px] font-medium hover:text-accent">
        {fav.label}
      </Link>
      <button
        type="button"
        className="w-5 h-5 rounded-full border-none bg-surface-2 text-muted text-[15px] leading-none inline-flex items-center justify-center hover:bg-danger hover:text-white"
        disabled={pending}
        aria-label={`Remover ${fav.label}`}
        onClick={() =>
          start(() =>
            removeFavorite(fav.id).then((r) => {
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
