"use client";

import { useEffect, useState } from "react";
import type { LoaderStep } from "./EditorLoader";

export type VideoState = "loading" | "ready" | "buffering" | "error";
type ServerStatus = { status: "idle" | "resolving" | "downloading" | "ready"; processedMs?: number };

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Cobre o player enquanto a mídia não chega. Com `progressUrl`, consulta a
 * preparação no servidor (yt-dlp + ffmpeg) e mostra o progresso real.
 */
export function VideoLoadingOverlay({ state, progressUrl, durationMs }: {
  state: VideoState;
  progressUrl?: string;
  durationMs: number;
}) {
  const [server, setServer] = useState<ServerStatus | null>(null);
  const polling = state === "loading" && !!progressUrl && server?.status !== "ready";

  useEffect(() => {
    if (!polling) return;
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch(progressUrl, { cache: "no-store" });
        if (res.ok && alive) setServer(await res.json() as ServerStatus);
      } catch {
        // Falha pontual de rede: tenta de novo no próximo ciclo.
      }
    };
    void tick();
    const id = setInterval(tick, 1000);
    return () => { alive = false; clearInterval(id); };
  }, [polling, progressUrl]);

  if (state === "ready") return null;

  if (state === "error") {
    return <div role="alert" className="absolute inset-0 z-20 grid place-items-center bg-black/80 p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-2">
        <p className="text-sm font-medium text-[#e7e7ea]">Não foi possível carregar o vídeo.</p>
        <p className="text-xs text-white/60">Recarregue a página para tentar novamente.</p>
      </div>
    </div>;
  }

  if (state === "buffering") {
    return <div role="status" aria-live="polite" className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/30">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/20 border-t-accent" />
      <span className="sr-only">Carregando…</span>
    </div>;
  }

  const status = server?.status ?? "idle";
  const processedMs = server?.processedMs ?? 0;
  const pct = progressUrl && status === "downloading" && durationMs > 0 ? Math.min(99, Math.round((processedMs / durationMs) * 100)) : null;
  const steps: LoaderStep[] | null = progressUrl ? [
    { label: "Buscando o vídeo no YouTube", state: status === "idle" || status === "resolving" ? "active" : "done" },
    { label: pct !== null ? `Baixando e preparando o vídeo (${pct}%)` : "Baixando e preparando o vídeo", state: status === "downloading" ? "active" : status === "ready" ? "done" : "todo" },
    { label: "Carregando no editor", state: status === "ready" ? "active" : "todo" },
  ] : null;

  return <div role="status" aria-live="polite" className="absolute inset-0 z-20 grid place-items-center bg-black/75 p-4">
    <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-accent" />
      <p className="text-sm font-medium text-[#e7e7ea]">Carregando o vídeo para clipar…</p>
      {pct !== null && <p className="text-2xl font-semibold tabular-nums text-accent">{pct}%</p>}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        {pct === null
          ? <div className="loader-indeterminate h-full w-2/5 rounded-full bg-accent" />
          : <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />}
      </div>
      {pct !== null && <p className="text-[11px] tabular-nums text-white/60">{fmt(processedMs)} de {fmt(durationMs)} processados</p>}
      {steps && <ol className="mt-1 flex w-full flex-col gap-2 text-left">
        {steps.map((s) => <li key={s.label.replace(/ \(.*\)$/, "")} className="flex items-center gap-2.5 text-xs">
          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${s.state === "done" ? "bg-accent text-accent-fg" : s.state === "active" ? "animate-spin border-2 border-accent border-t-transparent" : "border border-white/25"}`}>
            {s.state === "done" ? "✓" : ""}
          </span>
          <span className={s.state === "todo" ? "text-white/40" : s.state === "active" ? "text-[#e7e7ea]" : "text-white/60"}>{s.label}</span>
        </li>)}
      </ol>}
      {!steps && <p className="text-[11px] text-white/60">Isso pode levar alguns segundos.</p>}
    </div>
  </div>;
}
