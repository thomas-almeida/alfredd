"use client";

import { useEffect, useState } from "react";
import { ClipCard, type ClipCardData } from "./ClipCard";
import { ClipPreviewModal } from "./ClipPreviewModal";
import { CLIP_GRID_CLS } from "./ClipGrid";
import { getSavedTwitchClipIds } from "@/features/library/actions";

/** Grade de clipes (home, página do streamer): clicar abre o preview com player. */
export function RecommendedClips({
  clips,
  trending = true,
}: {
  clips: ClipCardData[];
  trending?: boolean;
}) {
  const [active, setActive] = useState<ClipCardData | null>(null);
  const [savedIds, setSavedIds] = useState(() => new Set(clips.filter((clip) => clip.isSaved).map((clip) => clip.twitchId)));

  useEffect(() => {
    let cancelled = false;
    void getSavedTwitchClipIds(clips.map((clip) => clip.twitchId)).then((ids) => {
      if (!cancelled) setSavedIds((current) => new Set([...current, ...ids]));
    });
    return () => {
      cancelled = true;
    };
  }, [clips]);

  function markSaved(twitchId: string) {
    setSavedIds((current) => new Set(current).add(twitchId));
    setActive((current) => current && current.twitchId === twitchId ? { ...current, isSaved: true } : current);
  }

  return (
    <>
      <div className={CLIP_GRID_CLS}>
        {clips.map((c) => (
          <ClipCard key={c.twitchId} clip={{ ...c, isSaved: savedIds.has(c.twitchId) }} onSelect={setActive} trending={trending} />
        ))}
      </div>
      <ClipPreviewModal clip={active} onClose={() => setActive(null)} onSaved={markSaved} />
    </>
  );
}
