"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/client";
import type { ClipStatus } from "@/lib/supabase/database.types";

const LABEL: Record<ClipStatus, string> = {
  novo: "Novo",
  em_edicao: "Em edição",
  exportado: "Exportado",
  descartado: "Descartado",
};
const TONE = {
  novo: "neutral",
  em_edicao: "warning",
  exportado: "accent",
  descartado: "danger",
} as const;

/** Selo do status do clipe, atualizado ao vivo via Supabase Realtime. */
export function ClipStatusBadge({
  clipId,
  initial,
}: {
  clipId: string;
  initial: ClipStatus;
}) {
  const [status, setStatus] = useState<ClipStatus>(initial);

  useEffect(() => setStatus(initial), [initial]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`clip-status-${clipId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clips", filter: `id=eq.${clipId}` },
        (payload) => {
          const next = (payload.new as { clip_status?: ClipStatus }).clip_status;
          if (next) setStatus(next);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [clipId]);

  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
