"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { BroadcasterTag } from "./BroadcasterTag";
import { ClipPlayer } from "./ClipPlayer";
import type { ClipCardData } from "./ClipCard";
import { saveClip } from "@/features/library/actions";
import { UpgradeModal } from "@/features/billing/UpgradeModal";
import { useAuthModal } from "@/features/auth/AuthModal";
import { formatViews, timeAgo } from "@/lib/twitch/format";

export function ClipPreviewModal({
  clip,
  onClose,
}: {
  clip: ClipCardData | null;
  onClose: () => void;
}) {
  const { openAuth } = useAuthModal();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [limited, setLimited] = useState(false);

  const clipKey = clip?.twitchId ?? null;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Reseta só quando o clipe muda de fato, não a cada re-render do pai.
  useEffect(() => {
    setMsg(null);
    setSaved(false);
    setLimited(false);
    if (!clipKey) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [clipKey]);

  if (!clip) return null;

  function doSave() {
    if (!clip) return;
    const clipId = clip.twitchId;
    setMsg(null);
    start(async () => {
      const res = await saveClip(clipId);
      if (res.needsAuth) {
        openAuth({
          reason: "Crie sua conta para salvar e editar este clipe.",
          onSuccess: () => doSave(),
        });
        return;
      }
      if (res.quotaExceeded) {
        setLimited(true);
        return;
      }
      if (res.ok) {
        setSaved(true);
        setMsg("Clipe salvo! Abrindo o editor…");
        router.push(`/clipes/${clipId}/editor`);
      } else {
        setMsg(res.error ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={clip.title ?? "Clipe"}
    >
      <div
        className="relative w-full max-w-[720px] bg-surface border border-border-strong rounded-lg p-4 shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute -top-8 right-0 w-8 h-8 rounded-full bg-surface-2 text-fg text-xl leading-none hover:bg-surface-hover max-[560px]:top-2 max-[560px]:right-2"
          onClick={onClose}
          aria-label="Fechar"
        >
          ×
        </button>

        <div className="relative">
          <ClipPlayer
            clipId={clip.twitchId}
            thumbnailUrl={clip.thumbnailUrl}
            watchUrl={clip.url}
            autoPlay={!pending && !saved}
          />
          {((pending && !limited) || saved) && (
            <div className="absolute inset-0 rounded-lg bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
              <div className="w-11 h-11 rounded-full border-[3px] border-white/20 border-t-accent animate-spin" />
              <p className="text-[#e7e7ea] text-sm font-medium">
                {saved ? "Clipe salvo! Abrindo o editor…" : "Salvando o clipe…"}
              </p>
              <div className="w-48 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className="loader-indeterminate h-full w-2/5 rounded-full bg-accent" />
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 px-2 pb-2">
          <h2 className="text-base font-semibold">{clip.title || "Sem título"}</h2>
          <div className="flex items-center gap-3 text-muted text-[13px] mt-2">
            {clip.broadcasterName && (
              <BroadcasterTag
                name={clip.broadcasterName}
                avatar={clip.broadcasterAvatar}
                login={clip.broadcasterLogin}
                size={22}
                className="text-[13px] text-fg"
              />
            )}
            <span className="inline-flex items-center gap-1">
              <Icon name="eye" width={14} height={14} />
              {formatViews(clip.viewCount)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" width={14} height={14} />
              {timeAgo(clip.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <Button variant="primary" onClick={doSave} disabled={(pending && !limited) || saved}>
              {saved ? "Abrindo editor…" : pending && !limited ? "Salvando…" : "Salvar e Editar Clip"}
            </Button>
            <a
              href={clip.url ?? `https://clips.twitch.tv/${clip.twitchId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] text-muted hover:text-fg"
            >
              Assistir na Twitch ↗
            </a>
            <a
              href={`/clipes/${clip.twitchId}`}
              className="text-[13px] text-muted hover:text-fg"
            >
              Ver detalhes
            </a>
          </div>
          {msg && <p className="mt-3 text-[13px] text-muted">{msg}</p>}
        </div>
      </div>
      <UpgradeModal open={limited} onClose={() => setLimited(false)} />
    </div>
  );
}
