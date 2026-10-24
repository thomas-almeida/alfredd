"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  favoriteGame,
  favoriteStreamer,
  favoriteYoutuber,
  isFavorited,
  unfavorite,
  type ActionResult,
  type FavoriteTarget,
} from "./actions";
import { useAuthModal } from "@/features/auth/AuthModal";

type GameProps = {
  kind: "game";
  twitchId: string;
  name: string;
  boxArtUrl: string | null;
};
type StreamerProps = {
  kind: "streamer";
  twitchId: string;
  login: string;
  displayName: string;
  thumbnailUrl: string | null;
};
type YoutuberProps = {
  kind: "youtuber";
  channelId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
};

function toTarget(
  props: GameProps | StreamerProps | YoutuberProps,
): FavoriteTarget {
  return props.kind === "youtuber"
    ? { kind: "youtuber", channelId: props.channelId }
    : { kind: props.kind, twitchId: props.twitchId };
}

export function FavoriteButton(
  props: GameProps | StreamerProps | YoutuberProps,
) {
  const { openAuth } = useAuthModal();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  // null enquanto o status inicial ainda não chegou.
  const [favorited, setFavorited] = useState<boolean | null>(null);

  const targetId = props.kind === "youtuber" ? props.channelId : props.twitchId;
  useEffect(() => {
    let cancelled = false;
    setFavorited(null);
    setMsg(null);
    isFavorited(toTarget(props)).then((v) => {
      if (!cancelled) setFavorited(v);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.kind, targetId]);

  function remove() {
    setMsg(null);
    start(async () => {
      const res = await unfavorite(toTarget(props));
      if (res.ok) {
        setFavorited(false);
        setMsg("Removido dos favoritos.");
      } else {
        setMsg(res.error ?? "Não foi possível remover dos favoritos.");
      }
    });
  }

  function run() {
    setMsg(null);
    start(async () => {
      let res: ActionResult;
      if (props.kind === "game") {
        res = await favoriteGame({
          twitchId: props.twitchId,
          name: props.name,
          boxArtUrl: props.boxArtUrl,
        });
      } else if (props.kind === "youtuber") {
        res = await favoriteYoutuber({
          channelId: props.channelId,
          title: props.title,
          handle: props.handle,
          thumbnailUrl: props.thumbnailUrl,
        });
      } else {
        res = await favoriteStreamer({
          twitchId: props.twitchId,
          login: props.login,
          displayName: props.displayName,
          thumbnailUrl: props.thumbnailUrl,
        });
      }
      if (res.error === "unauthenticated") {
        openAuth({
          reason: "Entre para favoritar e acompanhar suas fontes.",
          onSuccess: () => run(),
        });
      } else if (res.ok) {
        setFavorited(true);
        setMsg(res.already ? "Já estava nos favoritos." : "Adicionado aos favoritos.");
      } else {
        setMsg(res.error ?? "Não foi possível favoritar.");
      }
    });
  }

  let label = favorited ? "Desfavoritar" : "Favoritar";
  if (pending) label = favorited ? "Removendo…" : "Salvando…";

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <Button
        variant="secondary"
        onClick={favorited ? remove : run}
        disabled={pending || favorited === null}
      >
        {label}
      </Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
