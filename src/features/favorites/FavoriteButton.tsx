"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  favoriteGame,
  favoriteStreamer,
  favoriteYoutuber,
  type ActionResult,
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

export function FavoriteButton(
  props: GameProps | StreamerProps | YoutuberProps,
) {
  const { openAuth } = useAuthModal();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
        setDone(true);
        setMsg(res.already ? "Já estava nos favoritos." : "Adicionado aos favoritos.");
      } else {
        setMsg(res.error ?? "Não foi possível favoritar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5 items-end">
      <Button variant="secondary" onClick={run} disabled={pending || done}>
        {done ? "Favoritado" : pending ? "Salvando…" : "Favoritar"}
      </Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
