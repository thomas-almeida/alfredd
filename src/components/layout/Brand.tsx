import Image from "next/image";
import Link from "next/link";

export function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 font-semibold tracking-tight"
      aria-label="Alfredd"
    >
      <Image
        src="/alfredd-icon.png"
        alt=""
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 rounded-sm object-cover"
        priority
      />
      {!collapsed && <span>Alfredd</span>}
    </Link>
  );
}
