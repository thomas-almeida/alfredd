"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { lineIndexAt, searchTranscript, selectionToTrim, type Transcript, type Trim } from "@/lib/transcript/client";
import type { Highlight } from "@/lib/transcript/client";
import { UpgradeModal } from "@/features/billing/UpgradeModal";

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const EMPTY_WORDS: Transcript["words"] = [];
const EMPTY_LINES: Transcript["lines"] = [];

export function TranscriptPanel({ videoRef, sourceUrl, transcript, onTranscript, onTrim, maxClipMs = 90_000, autoLoad = false, aiOnly = false, transcriptWindow, timeOffsetMs = 0, tall = false }: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sourceUrl: string;
  transcript: Transcript | null;
  onTranscript: (t: Transcript) => void;
  onTrim: (trim: Trim) => void;
  maxClipMs?: number;
  autoLoad?: boolean;
  aiOnly?: boolean;
  transcriptWindow?: { startMs: number; endMs: number };
  timeOffsetMs?: number;
  /** Usa a altura disponível no painel lateral do editor. */
  tall?: boolean;
}) {
  const [activeLine, setActiveLine] = useState(-1);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoLoadedRef = useRef(false);
  const viewTranscript = useMemo(() => {
    if (!transcript || !timeOffsetMs) return transcript;
    const shift = (ms: number) => Math.max(0, ms - timeOffsetMs);
    return {
      ...transcript,
      durationMs: Math.max(0, transcript.durationMs - timeOffsetMs),
      words: transcript.words.map((w) => ({ ...w, startMs: shift(w.startMs), endMs: shift(w.endMs) })),
      lines: transcript.lines.map((l) => ({ ...l, startMs: shift(l.startMs), endMs: shift(l.endMs) })),
      chunks: transcript.chunks.map((c) => ({ ...c, startMs: shift(c.startMs), endMs: shift(c.endMs) })),
    };
  }, [transcript, timeOffsetMs]);
  const words = viewTranscript?.words ?? EMPTY_WORDS;
  const lines = viewTranscript?.lines ?? EMPTY_LINES;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !transcript) return;
    const tick = () => setActiveLine(lineIndexAt(lines, v.currentTime * 1000));
    v.addEventListener("timeupdate", tick);
    tick();
    return () => v.removeEventListener("timeupdate", tick);
  }, [videoRef, transcript, lines]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-line="${activeLine}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeLine]);

  const hits = useMemo(() => query.length >= 3 ? searchTranscript(words, query, { limit: 20 }) : [], [words, query]);
  const seek = (ms: number) => { if (videoRef.current) videoRef.current.currentTime = ms / 1000; };

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/transcript", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: sourceUrl, ...transcriptWindow }) });
      const json = await res.json() as Transcript & { error?: string; code?: string };
      if (json.code === "quota_exceeded") setUpgradeOpen(true);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível transcrever o vídeo.");
      onTranscript(json);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (!autoLoad || transcript || autoLoadedRef.current) return;
    autoLoadedRef.current = true;
    void load();
  }, [autoLoad, transcript]);

  async function captureHighlights() {
    setHighlightsLoading(true); setError(null);
    try {
      const res = await fetch("/api/transcript/highlights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl, ...transcriptWindow, count: 5, minSeconds: 15, maxSeconds: 60 }),
      });
      const json = await res.json() as { highlights?: Highlight[]; error?: string; code?: string };
      if (json.code === "quota_exceeded") setUpgradeOpen(true);
      if (!res.ok) throw new Error(json.error ?? "Não foi possível capturar os destaques.");
      setHighlights((json.highlights ?? []).map((h) => timeOffsetMs ? { ...h, startMs: Math.max(0, h.startMs - timeOffsetMs), endMs: Math.max(0, h.endMs - timeOffsetMs) } : h));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setHighlightsLoading(false); }
  }

  function chooseWord(index: number) {
    if (selectionStart === null || selectionEnd !== null) {
      setSelectionStart(index); setSelectionEnd(null); seek(words[index]?.startMs ?? 0); return;
    }
    const from = Math.min(selectionStart, index), to = Math.max(selectionStart, index);
    const trim = selectionToTrim(words, from, to, { maxMs: maxClipMs, durationMs: viewTranscript?.durationMs });
    setSelectionEnd(index); setSelectedHighlight(null); onTrim(trim); seek(trim.startMs);
  }

  function onMouseUp() {
    if (!transcript) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const idx = (node: Node | null) => {
      const el = (node instanceof Element ? node : node?.parentElement)?.closest("[data-w]");
      return el ? Number(el.getAttribute("data-w")) : null;
    };
    const a = idx(sel.anchorNode), b = idx(sel.focusNode);
    if (a === null || b === null) return;
    const trim = selectionToTrim(words, a, b, { maxMs: maxClipMs, durationMs: viewTranscript?.durationMs });
    setSelectedHighlight(null); onTrim(trim); seek(trim.startMs); sel.removeAllRanges();
  }

  return <div className="flex min-h-56 flex-col gap-2 rounded-md border border-border bg-surface p-3">
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-medium">Transcrição</span>
      {!transcript && <Button size="sm" onClick={load} disabled={loading}>{loading ? "Transcrevendo…" : "Carregar"}</Button>}
    </div>
    {error && <p className="text-xs text-danger">{error}</p>}
    {!transcript ? <p className="text-xs text-muted">Carregue a fala para buscar e selecionar um trecho do vídeo.</p> : <>
      {!aiOnly && <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar na fala…" className="rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm outline-none" />}
      {hits.length > 0 && <ul className="max-h-24 overflow-auto rounded-md border border-border text-xs">{hits.map((h) => <li key={`${h.wordStart}-${h.startMs}`}><button type="button" onClick={() => seek(h.startMs)} className="w-full px-2 py-1 text-left hover:bg-surface-hover"><span className="mr-2 font-mono text-accent">{fmt(h.startMs)}</span>{h.snippet}</button></li>)}</ul>}
      <div className="flex flex-wrap items-center gap-2">
        {!aiOnly && <p className="text-xs text-muted">Arraste sobre as palavras ou clique na primeira e na última.</p>}
        <Button size="md" variant="primary" onClick={captureHighlights} disabled={highlightsLoading}>
          {highlightsLoading ? "Capturando…" : "Capturar Destaques"}
        </Button>
      </div>
      {!aiOnly && selectionStart !== null && selectionEnd === null && <p className="text-xs text-accent">Início marcado. Clique na palavra final.</p>}
      {highlights.length > 0 && <div className="flex flex-col gap-2 rounded-lg border border-accent/35 bg-gradient-to-br from-accent/10 via-surface to-surface p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-semibold text-fg">Para virar Clip</span>
            <p className="mt-0.5 text-[11px] text-muted">Escolha um momento e abra no editor para ajustar o corte.</p>
          </div>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">IA</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {highlights.map((h) => { const key = `${h.startMs}-${h.endMs}`; const selected = selectedHighlight === key; return <button key={key} type="button" onClick={() => { setSelectedHighlight(key); onTrim(h); seek(h.startMs); }} className={`group rounded-md border px-3 py-2 text-left transition ${selected ? "border-accent bg-accent/20 shadow-sm" : "border-border bg-surface/70 hover:border-accent/60 hover:bg-accent/10"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-xs text-fg">{h.title || h.hook || "Momento recomendado"}</span>
              {selected ? <span className="text-[10px] font-semibold text-accent">Selecionado ✓</span> : <span className="text-[10px] text-muted group-hover:text-accent">Usar trecho →</span>}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
              <span className="font-mono text-accent">{fmt(h.startMs)}–{fmt(h.endMs)}</span>
              {h.score > 0 && <span>· potencial {Math.round(h.score)}%</span>}
            </div>
            {selected && <p className="mt-1.5 text-[11px] text-fg/80">Este trecho está pronto. Use “Abrir no editor” para começar a editar.</p>}
          </button>; })}
        </div>
      </div>}
      <div ref={listRef} onMouseUp={aiOnly ? undefined : onMouseUp} className={`${tall ? "min-h-[20rem] max-h-[calc(100vh-14rem)]" : "max-h-72"} overflow-auto pr-1 text-sm leading-relaxed ${aiOnly ? "select-none" : "select-text"}`}>
        {lines.map((line) => <div key={line.index} data-line={line.index} className={`flex gap-2 rounded px-1 py-0.5 ${line.index === activeLine ? "bg-accent/15" : ""}`}>
          <button type="button" onClick={() => seek(line.startMs)} className="shrink-0 select-none font-mono text-xs text-muted hover:text-accent">{fmt(line.startMs)}</button>
          <span>{words.slice(line.wordStart, line.wordEnd + 1).map((w, i) => { const wi = line.wordStart + i; const selected = selectionStart !== null && selectionEnd !== null && wi >= Math.min(selectionStart, selectionEnd) && wi <= Math.max(selectionStart, selectionEnd); return <span key={`${line.index}-${i}`} data-w={wi} onClick={aiOnly ? undefined : () => chooseWord(wi)} className={aiOnly ? "" : `cursor-pointer rounded ${selected ? "bg-accent/30" : "hover:bg-surface-hover"}`}>{w.text} </span>; })}</span>
        </div>)}
      </div>
    </>}
    <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} title="Limite do plano Free atingido" description="Você atingiu o limite diário desse recurso. Assine o PRO para continuar usando destaques e transcrições com limites maiores." />
  </div>;
}
