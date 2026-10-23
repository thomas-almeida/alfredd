import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "danger" | "warning" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "text-muted border-border",
  accent: "text-accent border-accent/30 bg-accent/10",
  danger: "text-danger border-danger/35 bg-danger/10",
  warning: "text-warning border-warning/35 bg-warning/10",
  info: "text-info border-info/35 bg-info/10",
};

/** Badge com quadradinho de status (ex.: "1 open case", "Normal / Unusual"). */
export function Badge({
  tone = "neutral",
  children,
  square = true,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  square?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-2 py-[3px] rounded-sm text-xs font-medium leading-snug border",
        tones[tone],
      )}
    >
      {square && (
        <span
          className="w-2 h-2 rounded-[2px] shrink-0 bg-current"
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}
