"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { clipThumb, formatViews, timeAgo } from "@/lib/twitch/format";
import { setLibraryStatus, removeLibraryItem } from "./actions";
import type { LibraryStatus } from "@/lib/supabase/database.types";

export interface LibraryItemView {
  id: string;
  status: LibraryStatus;
  twitchId: string;
  title: string | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  createdAt: string;
  officialUrl: string;
}

const STATUS_OPTIONS: Array<{ value: LibraryStatus; label: string }> = [
  { value: "salvo", label: "Salvo" },
  { value: "em_edicao", label: "Em edição" },
  { value: "publicado", label: "Publicado" },
];

const actionBtn =
  "bg-transparent border border-border rounded-sm px-2 py-1 text-xs text-muted hover:text-fg hover:border-border-strong";

export function LibraryItemCard({ item, isPro }: { item: LibraryItemView; isPro: boolean }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<LibraryStatus>(item.status);
  const [removed, setRemoved] = useState(false);
  const [copied, setCopied] = useState(false);

  if (removed) return null;

  function changeStatus(value: LibraryStatus) {
    setStatus(value);
    start(() => setLibraryStatus(item.id, value).then(() => undefined));
  }

  function remove() {
    start(() =>
      removeLibraryItem(item.id).then((r) => {
        if (r.ok) setRemoved(true);
      }),
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.officialUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignora */
    }
  }

  const thumb = clipThumb(item.thumbnailUrl);

  return (
    <div className="flex gap-4 p-3 border border-border rounded-lg bg-surface max-[560px]:flex-col">
      <Link
        href={`/clipes/${item.twitchId}`}
        className="w-40 aspect-video rounded-md overflow-hidden shrink-0 bg-surface-2 max-[560px]:w-full"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-surface-2" />
        )}
      </Link>
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <Link
          href={`/clipes/${item.twitchId}`}
          className="text-[13px] font-semibold hover:text-accent"
        >
          {item.title || "Sem título"}
        </Link>
        <div className="flex items-center gap-3">
          <Badge tone="neutral">{formatViews(item.viewCount)} views</Badge>
          <span className="text-xs text-subtle">{timeAgo(item.createdAt)}</span>
        </div>
        <div className="flex gap-2 mt-auto flex-wrap items-center">
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as LibraryStatus)}
            disabled={pending}
            className="bg-surface-2 border border-border-strong rounded-sm text-fg px-2 py-1 text-xs"
            aria-label="Status do clipe"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Link href={`/clipes/${item.twitchId}/editor`} className={actionBtn}>
            Cortar
          </Link>
          <button className={actionBtn} onClick={copy} type="button">
            {copied ? "Copiado" : "Copiar link"}
          </button>
          {isPro && (
            <button
              className="bg-transparent border border-border rounded-sm px-2 py-1 text-xs text-muted hover:text-danger hover:border-danger"
              onClick={remove}
              type="button"
              disabled={pending}
            >
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
