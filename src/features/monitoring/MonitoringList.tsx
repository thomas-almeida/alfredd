"use client";

import { useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { createMonitoring, disableMonitoring } from "./actions";

type Target = { id: string; label: string; avatar: string | null; sourceType: "game" | "streamer"; monitored: boolean; monitoringId?: string };

export function MonitoringList({ targets }: { targets: Target[] }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      {targets.map((target) => (
        <div key={`${target.sourceType}:${target.id}`} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface p-4">
          <div className="flex min-w-0 items-center gap-3">
            {target.avatar ? <Image src={target.avatar} alt="" width={40} height={40} className={`h-10 w-10 object-cover ${target.sourceType === "game" ? "rounded-sm" : "rounded-full"}`} /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 font-bold">{target.label.charAt(0).toUpperCase()}</span>}
            <div><p className="font-medium truncate">{target.label}</p><p className="text-xs text-muted">{target.sourceType === "game" ? "Jogo" : "Criador Twitch"}</p></div>
          </div>
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
