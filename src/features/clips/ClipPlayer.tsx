"use client";

import { useEffect, useState } from "react";
import { clipThumb } from "@/lib/twitch/format";

/**
 * Player próprio: toca o MP4 do clipe direto num <video>, via URL assinada de
 * /api/clips/[id]/preview (sem embed da Twitch, que exige login em canais
 * adultos e começa mudo). Se não resolver, mostra a thumbnail + link oficial.
 */
export function ClipPlayer({
  clipId,
  thumbnailUrl,
  watchUrl,
  autoPlay = false,
}: {
  clipId: string;
  thumbnailUrl?: string | null;
  watchUrl?: string | null;
  autoPlay?: boolean;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const thumb = thumbnailUrl ? clipThumb(thumbnailUrl) : null;

  useEffect(() => {
    let alive = true;
    setSrc(null);
    setFailed(false);
    fetch(`/api/clips/${clipId}/preview`)
      .then((r) => (r.ok ? (r.json() as Promise<{ url: string }>) : Promise.reject()))
      .then((j) => alive && setSrc(j.url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [clipId]);

  if (failed) {
    return (
      <div
        className="relative aspect-video w-full rounded-lg overflow-hidden bg-surface-2 border border-border bg-cover bg-center"
        style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 p-6 bg-gradient-to-b from-black/55 to-black/80">
          <p className="text-[#e7e7ea] text-[13px] max-w-[44ch]">
            Não foi possível carregar a prévia deste clipe.
          </p>
          <a
            href={watchUrl ?? `https://clips.twitch.tv/${clipId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-twitch text-white font-semibold text-[13px] px-4 py-2.5 rounded-sm hover:brightness-110"
          >
            ▶ Assistir na Twitch
          </a>
        </div>
      </div>
    );
  }

  return (
    <video
      key={src ?? "loading"}
      src={src ?? undefined}
      poster={thumb ?? undefined}
      controls
      // Esconde "Baixar"/PiP/menu de contexto. Só dissuade: a URL assinada continua
      // visível no DevTools, e o clipe já é público na Twitch.
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      autoPlay={autoPlay}
      playsInline
      onError={() => src && setFailed(true)}
      className="aspect-video w-full rounded-lg bg-black border border-border"
    />
  );
}
