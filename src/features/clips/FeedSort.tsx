"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const OPTIONS: Array<{ value: string; label: string }> = [
  { value: "recentes", label: "Mais recentes" },
  { value: "vistos", label: "Mais vistos" },
];

/** Ordenação local do feed. "vistos" é a ordem nativa da Twitch; "recentes"
 *  reordena por created_at (a API não ordena por data). */
export function FeedSort({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setSort(value: string) {
    const p = new URLSearchParams(params);
    p.set("sort", value);
    router.replace(`${pathname}?${p.toString()}`);
  }

  return (
    <div
      className="inline-flex gap-1 bg-surface-2 rounded-sm p-[3px] mb-5"
      role="tablist"
      aria-label="Ordenar"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={current === o.value}
          className={cn(
            "px-3 py-2 rounded-[4px] text-[13px] font-medium",
            current === o.value
              ? "bg-surface-hover text-fg"
              : "bg-transparent text-muted",
          )}
          onClick={() => setSort(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
