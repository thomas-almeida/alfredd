"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function SaveYoutubeClipButton({ videoId, title, channelTitle, thumbnailUrl, durationSeconds }: {
  videoId: string; title: string; channelTitle: string; thumbnailUrl: string | null; durationSeconds: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/youtube/clips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId, title, channelTitle, thumbnailUrl, durationMs: durationSeconds == null ? null : durationSeconds * 1000 }) });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Não foi possível salvar o vídeo.");
      router.push(`/youtube/clips/${data.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }
  return <div className="flex flex-col items-start gap-1.5">
    <Button variant="primary" onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar e Clipar este vídeo"}</Button>
    {error && <span className="text-xs text-danger">{error}</span>}
  </div>;
}
