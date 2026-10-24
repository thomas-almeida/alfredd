"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Highlight, Trim } from "@/lib/transcript/client";
import { UpgradeModal } from "@/features/billing/UpgradeModal";

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const COUNT = 5;

/** Captura destaques via IA e lista cada um como card com a thumb do vídeo. */
export function HighlightsPanel({ videoRef, sourceUrl, onTrim, thumbnailUrl, ready = true, transcriptWindow, timeOffsetMs = 0 }: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sourceUrl: string;
  onTrim: (trim: Trim) => void;
  thumbnailUrl: string | null;
  /** Falso enquanto a transcrição ainda não foi carregada. */
  ready?: boolean;
  transcriptWindow?: { startMs: number; endMs: number };
  timeOffsetMs?: number;
}) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const seek = (ms: number) => { if (videoRef.current) videoRef.current.currentTime = ms / 1000; };

  // Depende dos números, não do objeto: o pai costuma recriar a janela a cada render.
  const windowStart = transcriptWindow?.startMs;
  const windowEnd = transcriptWindow?.endMs;
  const request = useCallback(async (extra: { force?: boolean; cachedOnly?: boolean }) => {
    const res = await fetch("/api/transcript/highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: sourceUrl, startMs: windowStart, endMs: windowEnd, count: COUNT, minSeconds: 15, maxSeconds: 60, ...extra }),
    });
    const json = await res.json() as { highlights?: Highlight[] | null; cached?: boolean; error?: string; code?: string };
    return { res, json };
  }, [sourceUrl, windowStart, windowEnd]);
  // Os destaques vêm em tempo absoluto; com janela, o player começa no início dela.
  const toPlayer = useCallback((list: Highlight[]) => {
    const end = windowEnd ?? Infinity;
    return list.filter((h) => h.endMs > timeOffsetMs && h.startMs < end)
      .map((h) => ({ ...h, startMs: Math.max(0, h.startMs - timeOffsetMs), endMs: Math.min(end - timeOffsetMs, h.endMs - timeOffsetMs) }));
  }, [timeOffsetMs, windowEnd]);

  // Destaques já salvos para esta fonte aparecem sem gastar cota.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    request({ cachedOnly: true }).then(({ res, json }) => {
      if (alive && res.ok && json.highlights?.length) { setHighlights(toPlayer(json.highlights)); setSaved(true); }
    }).catch(() => { /* Sem cache: o usuário captura manualmente. */ });
    return () => { alive = false; };
  }, [ready, request, toPlayer]);

  async function capture() {
    setLoading(true); setError(null);
    try {
      // Com destaques na tela, o botão pede uma nova geração em vez do salvo.
      const { res, json } = await request({ force: highlights.length > 0 });
      if (json.code === "quota_exceeded") setUpgradeOpen(true);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível capturar os destaques.");
      setSelected(null);
      setSaved(json.cached === true);
      setHighlights(toPlayer(json.highlights ?? []));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  return <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-fg">Para virar Clip</h2>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">IA</span>
          {saved && highlights.length > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-muted" title="Destaques salvos: reabrir não gasta cota">Salvo</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {ready ? "Escolha um momento e abra no editor para ajustar o corte." : "Aguardando a transcrição para sugerir os melhores momentos…"}
        </p>
      </div>
      <Button size="md" variant="primary" onClick={capture} disabled={!ready || loading}>
        {loading ? "Capturando…" : highlights.length ? "Capturar novamente" : "Capturar Destaques"}
      </Button>
    </div>
    {error && <p className="text-xs text-danger">{error}</p>}
    {loading ? <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {Array.from({ length: COUNT }, (_, i) => <div key={i} className="flex flex-col gap-2">
        <div className="aspect-video animate-pulse rounded-md bg-surface-2" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-surface-2" />
      </div>)}
    </div> : highlights.length > 0 ? <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
      {highlights.map((h) => {
        const key = `${h.startMs}-${h.endMs}`;
        const isSelected = selected === key;
        return <button key={key} type="button" onClick={() => { setSelected(key); onTrim(h); seek(h.startMs); }} className={`group flex flex-col overflow-hidden rounded-md border text-left transition ${isSelected ? "border-accent bg-accent/15 shadow-sm" : "border-border bg-surface-2 hover:border-accent/60 hover:bg-accent/10"}`}>
          <div className="relative aspect-video bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumbnailUrl && <img src={thumbnailUrl} alt="" loading="lazy" className={`h-full w-full object-cover transition ${isSelected ? "" : "opacity-80 group-hover:opacity-100"}`} />}
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">{fmt(h.startMs)}–{fmt(h.endMs)}</span>
            {h.score > 0 && <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-medium text-white">{Math.round(h.score)}%</span>}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-2.5">
            <span className="line-clamp-2 text-xs font-medium text-fg">{h.title || h.hook || "Momento recomendado"}</span>
            {isSelected ? <span className="text-[10px] font-semibold text-accent">Selecionado ✓</span> : <span className="text-[10px] text-muted group-hover:text-accent">Usar trecho →</span>}
          </div>
        </button>;
      })}
    </div> : <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-muted">
      Clique em Capturar Destaques para a IA sugerir até {COUNT} trechos de 15 a 60 segundos.
    </p>}
    <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="Limite do plano Free atingido" description="Você atingiu o limite diário desse recurso. Assine o PRO para continuar usando destaques e transcrições com limites maiores." />
  </section>;
}
