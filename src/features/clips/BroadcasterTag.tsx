import Link from "next/link";
import { cn } from "@/lib/cn";

/** Avatar + nome do streamer dono do clipe. Com `login`, vira link para o canal. */
export function BroadcasterTag({
  name,
  avatar,
  login,
  size = 18,
  className,
}: {
  name: string;
  avatar?: string | null;
  login?: string | null;
  size?: number;
  className?: string;
}) {
  const content = (
    <>
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          className="rounded-full object-cover shrink-0 bg-surface-2"
          style={{ width: size, height: size }}
        />
      ) : (
        <span
          className="rounded-full bg-surface-2 shrink-0 flex items-center justify-center text-[10px] font-bold text-muted"
          style={{ width: size, height: size }}
          aria-hidden
        >
          {name[0]?.toUpperCase()}
        </span>
      )}
      <span className="truncate">{name}</span>
    </>
  );
  const cls = cn("inline-flex items-center gap-1.5 min-w-0 text-xs text-muted", className);

  return login ? (
    <Link href={`/streamers/${login}`} className={cn(cls, "hover:text-fg")}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}
