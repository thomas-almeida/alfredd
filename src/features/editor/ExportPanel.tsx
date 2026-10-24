"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { useEditor } from "@/lib/editor/store";
import type { ExportMessage, ExportRequest } from "@/lib/export/export.worker";
import type { Transcript } from "@/lib/transcript/client";
import { saveToDownloadDirectory } from "@/lib/downloads/directory";

type Phase = "idle" | "encoding" | "uploading" | "done" | "error";

/**
 * Export no navegador (Mediabunny + WebCodecs em Web Worker), upload para
 * shorts/{userId}/{renderId}.mp4, registro em renders e status 'exportado'.
 */
export function ExportPanel({
  clipId,
  userId,
  sourceUrl,
  fileName,
  persist = true,
  transcript,
  captionsEnabled = false,
  onExported,
}: {
  clipId: string;
  userId: string;
  sourceUrl: string;
  fileName: string;
  persist?: boolean;
  transcript?: Transcript | null;
  captionsEnabled?: boolean;
  onExported?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [savingDownload, setSavingDownload] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  const supported = typeof window !== "undefined" && "VideoEncoder" in window;

  function cancel() {
    workerRef.current?.terminate();
    workerRef.current = null;
    setPhase("idle");
  }

  function start() {
    const state = useEditor.getState().snapshot();
    setError(null);
    setProgress(0);
    setPhase("encoding");
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);

    const worker = new Worker(
      new URL("../../lib/export/export.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    worker.onmessage = async (e: MessageEvent<ExportMessage>) => {
      const m = e.data;
      if (m.type === "progress") {
        setProgress(m.value);
        return;
      }
      worker.terminate();
      workerRef.current = null;
      if (m.type === "error") {
        setError(m.message);
        setPhase("error");
        return;
      }

      const blob = new Blob([m.buffer], { type: "video/mp4" });
      setDownloadUrl(URL.createObjectURL(blob));
      if (!persist) {
        setProgress(1);
        setPhase("done");
        onExported?.();
        return;
      }
      setPhase("uploading");
      try {
        const supabase = createClient();
        const renderId = crypto.randomUUID();
        const path = `${userId}/${renderId}.mp4`;
        const up = await supabase.storage
          .from("shorts")
          .upload(path, blob, { contentType: "video/mp4" });
        if (up.error) throw up.error;
        const ins = await supabase.from("renders").insert({
          id: renderId,
          clip_id: clipId,
          user_id: userId,
          project_state: state as unknown as Json,
          output_path: path,
          duration: m.duration,
          size_bytes: blob.size,
        });
        if (ins.error) throw ins.error;
        await supabase.rpc("set_clip_status", {
          p_clip_id: clipId,
          p_status: "exportado",
        });
        setProgress(1);
        setPhase("done");
        onExported?.();
      } catch (err) {
        // O arquivo local continua disponível para download mesmo se o upload falhar.
        setError(err instanceof Error ? err.message : "Falha no upload.");
        setPhase("error");
      }
    };
    const captions = captionsEnabled && transcript ? transcript.lines.map((line) => ({ startMs: line.startMs, endMs: line.endMs, text: line.text })) : [];
    worker.postMessage({ sourceUrl: new URL(sourceUrl, location.href).href, state, captions } satisfies ExportRequest);
  }

  async function download() {
    if (!downloadUrl) return;
    setSavingDownload(true);
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const saved = await saveToDownloadDirectory(blob, fileName);
      if (!saved) {
        const anchor = document.createElement("a");
        anchor.href = downloadUrl;
        anchor.download = fileName;
        anchor.click();
      }
    } finally {
      setSavingDownload(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-[13px] text-muted">
        Seu navegador não suporta WebCodecs. Use Chrome, Edge ou Safari recentes para exportar.
      </p>
    );
  }

  const busy = phase === "encoding" || phase === "uploading";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        <Button variant="primary" onClick={start} disabled={busy}>
          {phase === "encoding"
            ? `Exportando… ${Math.round(progress * 100)}%`
            : phase === "uploading"
              ? "Enviando…"
              : "Exportar MP4 1080×1920"}
        </Button>
        {phase === "encoding" && (
          <Button variant="ghost" onClick={cancel}>
            Cancelar
          </Button>
        )}
        {downloadUrl && (
          <Button variant="secondary" onClick={download} disabled={savingDownload}>
            {savingDownload ? "Salvando…" : "Baixar MP4"}
          </Button>
        )}
      </div>
      {busy && (
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full bg-accent transition-[width]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
      {phase === "done" && <p className="text-[13px] text-muted">Short exportado e salvo.</p>}
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
