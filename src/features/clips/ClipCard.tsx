import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { clipThumb, timeAgo, formatViews, formatDuration } from "@/lib/twitch/format";
import { Icon } from "@/components/ui/Icon";
import { BroadcasterTag } from "./BroadcasterTag";

export interface ClipCardData {
  twitchId: string;
  title: string | null;
  broadcasterName?: string | null;
  broadcasterLogin?: string | null;
  broadcasterAvatar?: string | null;
  thumbnailUrl: string | null;
  viewCount: number | null;
  durationSeconds: number | null;
  createdAt: string;
  /** URL oficial do clipe na Twitch (fallback para conteúdo com gate). */
  url?: string | null;
  /** Canal classificado como adulto — embed exige login na Twitch. */
  isMature?: boolean;
  isSaved?: boolean;
}

const cardCls =
  "flex flex-col border border-border rounded-lg overflow-hidden bg-surface transition-[border-color,transform] hover:border-border-strong hover:-translate-y-0.5 text-left w-full p-0 font-[inherit] text-[inherit] cursor-pointer";

export function ClipCard({
  clip,
  onSelect,
  trending = false,
}: {
  clip: ClipCardData;
  /** Se fornecido, o card vira botão e chama onSelect (ex.: abrir preview). */
  onSelect?: (clip: ClipCardData) => void;
  /** Vitrine de mais vistos: destaca os clipes em alta. */
  trending?: boolean;
}) {
  const thumb = clipThumb(clip.thumbnailUrl);
  const isNew = new Date(clip.createdAt).toDateString() === new Date().toDateString();

  const inner = (
    <>
      <div className="relative aspect-video bg-surface-2">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="w-full h-full object-cover block" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-subtle" aria-hidden>
            <Icon name="film" width={22} height={22} />
          </div>
        )}
        <span className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-2 py-0.5 rounded-sm">
          {formatDuration(clip.durationSeconds)}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold leading-snug line-clamp-2">
          {clip.title || "Sem título"}
        </h3>
        {clip.broadcasterName && (
          <BroadcasterTag name={clip.broadcasterName} avatar={clip.broadcasterAvatar} />
        )}
        <div className="flex gap-3 text-subtle text-xs">
          <span suppressHydrationWarning className="inline-flex items-center gap-1">
            <Icon name="eye" width={14} height={14} />
            {formatViews(clip.viewCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" width={14} height={14} />
            {timeAgo(clip.createdAt)}
          </span>
        </div>
        <div className="mt-1">
          <div className="flex flex-wrap gap-2">
            {trending && <Badge tone="accent">Em alta</Badge>}
            {isNew && <Badge tone="info">NOVO</Badge>}
            {clip.isSaved && <Badge tone="neutral">Salvo</Badge>}
          </div>
        </div>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button type="button" className={cardCls} onClick={() => onSelect(clip)}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={`/clipes/${clip.twitchId}`} className={cardCls}>
      {inner}
    </Link>
  );
}
