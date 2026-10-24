"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { ClipCardData } from "@/features/clips/ClipCard";
import { ClipPreviewModal } from "@/features/clips/ClipPreviewModal";
import { lookupClip } from "./actions";
import { parseTwitchLink } from "./twitchLink";
import { parseChannel, parseVideo } from "@/lib/youtube/parse";
import { parseTwitchUrl } from "@/lib/twitch/media/gql";

/**
 * Campo de busca unificado (jogos/streamers). Encaminha a query para /explorar;
 * a busca real na Twitch Helix acontece lá. Links colados são atalhos: clipe abre
 * o preview em modal e canal leva à página do streamer.
 */
export function SearchBox({
  size = "md",
  autoFocus = false,
}: {
  size?: "sm" | "md" | "lg";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [clip, setClip] = useState<ClipCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Navegações via router.push ficam "pendentes" até a nova rota renderizar.
  const [navigating, startNav] = useTransition();
  const loading = busy || navigating;

  async function go(raw: string) {
    const term = raw.trim();
    setError(null);
    const youtubeVideo = parseVideo(term);
    if (youtubeVideo) {
      setQ("");
      startNav(() => router.push(`/youtube?video=${encodeURIComponent(youtubeVideo.videoId)}`));
      return;
    }
    const youtubeChannel = parseChannel(term);
    if (youtubeChannel) {
      setQ("");
      startNav(() => router.push(`/youtube?channel=${encodeURIComponent(youtubeChannel.value)}`));
      return;
    }
    const twitchMedia = parseTwitchUrl(term);
    if (twitchMedia) {
      setQ("");
      startNav(() => router.push(`/twitch?url=${encodeURIComponent(term)}`));
      return;
    }
    const link = parseTwitchLink(term);
    if (link?.kind === "channel") {
      setQ("");
      startNav(() => router.push(`/streamers/${link.login}`));
      return;
    }
    if (link?.kind === "clip") {
      setBusy(true);
      const found = await lookupClip(link.slug);
      setBusy(false);
      if (found) {
        setQ("");
        setClip(found);
      } else setError("Clipe não encontrado.");
      return;
    }
    startNav(() => router.push(term ? `/explorar?q=${encodeURIComponent(term)}` : "/explorar"));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void go(q);
  }

  function paste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").trim();
    if (!parseTwitchLink(text) && !parseTwitchUrl(text) && !parseVideo(text) && !parseChannel(text)) return;
    e.preventDefault();
    setQ(text);
    void go(text);
  }

  const lg = size === "lg";
  const sm = size === "sm";

  return (
    <>
      <form
        className={cn(
          "flex items-center gap-2 bg-surface border border-border-strong rounded-md w-full max-w-[560px] transition-colors focus-within:border-accent",
          lg ? "p-3 pl-4" : sm ? "p-1 pl-2.5" : "p-2 pl-3",
          error && "border-danger",
        )}
        onSubmit={submit}
        role="search"
      >
        <Icon name="search" className="text-subtle shrink-0" />
        <input
          className={cn(
            "flex-1 bg-transparent border-none outline-none text-fg min-w-0 placeholder:text-subtle focus:shadow-none",
            lg ? "text-base" : sm ? "text-[13px]" : "text-[0.875rem]",
          )}
          placeholder={
            sm ? "Buscar ou colar link da Twitch/Youtube…" : "Experimente: GTA VI"
          }
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setError(null);
          }}
          onPaste={paste}
          title={error ?? undefined}
          aria-label="Buscar jogos ou streamers"
          aria-invalid={!!error}
          autoFocus={autoFocus}
        />
        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className={cn(
            "shrink-0 inline-flex items-center justify-center gap-1.5 bg-accent text-accent-fg border-none rounded-sm font-semibold text-[13px] hover:brightness-110 disabled:opacity-60",
            sm ? "px-2.5 py-1" : "px-3.5 py-2",
          )}
        >
          {loading && (
            <span
              className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin"
              aria-hidden
            />
          )}
          {loading ? "Buscando" : sm ? "Buscar" : "Encontrar Conteúdo"}
        </button>
      </form>
      {error && !sm && <p className="text-[13px] text-danger mt-2">{error}</p>}
      <ClipPreviewModal clip={clip} onClose={() => setClip(null)} />
    </>
  );
}
