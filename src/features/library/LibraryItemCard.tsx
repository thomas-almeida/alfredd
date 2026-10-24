"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { BroadcasterTag } from "@/features/clips/BroadcasterTag";
import { ClipPreviewModal } from "@/features/clips/ClipPreviewModal";
import { clipThumb, formatViews, timeAgo } from "@/lib/twitch/format";
import { removeLibraryItem } from "./actions";
import { UpgradeModal } from "@/features/billing/UpgradeModal";

export interface LibraryItemView {
  id: string;
  twitchId: string;
  title: string | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  createdAt: string;
  officialUrl: string;
  broadcasterName: string | null;
  broadcasterLogin: string | null;
  broadcasterAvatar: string | null;
  gameName: string | null;
}

const actionBtn =
  "inline-flex items-center gap-1.5 bg-transparent border border-border rounded-sm px-2 py-1 text-xs text-muted hover:text-fg hover:border-border-strong";

const editBtn =
  "inline-flex items-center gap-1.5 bg-accent text-accent-fg rounded-sm px-3 py-1 text-xs font-semibold hover:brightness-110";

export function LibraryItemCard({ item, isPro }: { item: LibraryItemView; isPro: boolean }) {
  const [pending, start] = useTransition();
  const [removed, setRemoved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (removed) return null;

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
    <div className="flex flex-col gap-4 p-3 border border-border rounded-lg bg-surface max-[560px]:flex-col">
      <button
        type="button"
        onClick={() => setPreview(true)}
        className="aspect-video rounded-md overflow-hidden shrink-0 bg-surface-2 w-full p-0 border-none cursor-pointer"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-surface-2" />
        )}
      </button>
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="text-left text-[13px] font-semibold hover:text-accent bg-transparent border-none p-0 cursor-pointer"
        >
          {item.title || "Sem título"}
        </button>
        {(item.broadcasterName || item.gameName) && (
          <div className="flex items-center gap-2 min-w-0 text-xs text-muted">
            {item.broadcasterName && (
              <BroadcasterTag
                name={item.broadcasterName}
                avatar={item.broadcasterAvatar}
                login={item.broadcasterLogin}
              />
            )}
            {item.broadcasterName && item.gameName && <span className="text-subtle">·</span>}
            {item.gameName && <span className="truncate">{item.gameName}</span>}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Badge tone="neutral">{formatViews(item.viewCount)} views</Badge>
          <span suppressHydrationWarning className="text-xs text-subtle">{timeAgo(item.createdAt)}</span>
        </div>
        <div className="flex gap-2 mt-auto flex-wrap items-center">
          <Link href={`/clipes/${item.twitchId}/editor`} className={editBtn}>
            <Icon name="scissors" width={14} height={14} />
            Editar
          </Link>
          <button className={actionBtn} onClick={copy} type="button">
            <Icon name="link" width={14} height={14} />
            {copied ? "Copiado" : "Copiar link"}
          </button>
          <button
            className="bg-transparent border border-border rounded-sm px-2 py-1 text-xs text-muted hover:text-danger hover:border-danger"
            onClick={() => isPro ? remove() : setUpgradeOpen(true)}
            type="button"
            disabled={pending}
          >
            Remover
          </button>
        </div>
      </div>
      <ClipPreviewModal
        clip={
          preview
            ? {
                twitchId: item.twitchId,
                title: item.title,
                thumbnailUrl: item.thumbnailUrl,
                viewCount: item.viewCount,
                durationSeconds: null,
                createdAt: item.createdAt,
                url: item.officialUrl,
                broadcasterName: item.broadcasterName,
                broadcasterLogin: item.broadcasterLogin,
                broadcasterAvatar: item.broadcasterAvatar,
              }
            : null
        }
        onClose={() => setPreview(false)}
      />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="Recurso exclusivo do PRO" description="Remover clipes da biblioteca é um recurso premium. Assine o PRO para gerenciar sua biblioteca sem essa limitação." />
    </div>
  );
}
