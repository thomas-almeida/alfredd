"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createMonitoring, disableMonitoring } from "./actions";

type Target = { id: string; label: string; sourceType: "game" | "streamer"; monitored: boolean; monitoringId?: string };

export function MonitoringList({ targets }: { targets: Target[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {targets.map((target) => (
        <div key={`${target.sourceType}:${target.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-4">
          <div><p className="font-medium">{target.label}</p><p className="text-xs text-muted">{target.sourceType === "game" ? "Jogo" : "Criador Twitch"}</p></div>
          {target.monitored ? (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(() => void disableMonitoring(target.monitoringId!))}>Desativar</Button>
          ) : (
            <Button size="sm" variant="primary" disabled={pending} onClick={() => startTransition(() => void createMonitoring({ sourceType: target.sourceType, sourceId: target.id }))}>Monitorar</Button>
          )}
        </div>
      ))}
      {!targets.length && <p className="text-sm text-muted">Favorite um jogo ou criador Twitch para ativar um monitoramento.</p>}
    </div>
  );
}
