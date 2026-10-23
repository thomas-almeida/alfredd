import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/Badge";
import { boxArt } from "@/lib/twitch/format";

const cardCls =
  "flex gap-3 p-3 border border-border rounded-md bg-surface items-center transition-colors hover:border-border-strong";

/** Capa vertical no estilo do diretório da Twitch. */
export function CategoryCard({
  id,
  name,
  boxArtUrl,
}: {
  id: string;
  name: string;
  boxArtUrl: string | null;
}) {
  const img = boxArt(boxArtUrl, 285, 380);
  return (
    <Link href={`/jogos/${id}`} className="group flex flex-col gap-1.5 min-w-0" title={name}>
      <div className="aspect-[3/4] rounded-sm overflow-hidden bg-surface-2 transition-transform duration-150 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:shadow-[-6px_6px_0_var(--color-accent)]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-subtle">
            <Icon name="grid" width={32} height={32} />
          </div>
        )}
      </div>
      <span className="text-[13px] font-semibold truncate group-hover:text-accent">{name}</span>
    </Link>
  );
}

export function ChannelCard({
  login,
  displayName,
  thumbnailUrl,
  gameName,
}: {
  login: string;
  displayName: string;
  thumbnailUrl: string | null;
  gameName?: string | null;
}) {
  return (
    <Link href={`/streamers/${login}`} className={cardCls}>
      <div className="w-[72px] h-[72px] rounded-full overflow-hidden shrink-0 bg-surface-2">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-subtle">
            <Icon name="star" width={28} height={28} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <Badge tone="info">Streamer</Badge>
        <span className="text-[13px] font-semibold truncate">{displayName}</span>
        {gameName && <span className="text-xs text-subtle">{gameName}</span>}
      </div>
    </Link>
  );
}
