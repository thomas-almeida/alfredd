import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { ClipScoreStatus } from "@/lib/supabase/database.types";

/** Exibe o ClipScore (0–100) ou "Dados insuficientes". Nunca inventa número. */
export function ClipScoreBadge({
  value,
  status,
}: {
  value: number | null;
  status: ClipScoreStatus;
}) {
  if (status !== "ok" || value == null) {
    return (
      <Badge tone="neutral">
        {status === "novo" ? "Novo" : "Dados insuficientes"}
      </Badge>
    );
  }
  const tone: BadgeTone =
    value >= 75 ? "accent" : value >= 40 ? "warning" : "neutral";
  return <Badge tone={tone}>ClipScore {value}</Badge>;
}
