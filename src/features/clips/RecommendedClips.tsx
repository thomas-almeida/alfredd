"use client";

import { useState } from "react";
import { ClipCard, type ClipCardData } from "./ClipCard";
import { ClipPreviewModal } from "./ClipPreviewModal";
import { CLIP_GRID_CLS } from "./ClipGrid";

/** Grade de clipes (home, página do streamer): clicar abre o preview com player. */
export function RecommendedClips({
  clips,
  trending = true,
}: {
  clips: ClipCardData[];
  trending?: boolean;
}) {
  const [active, setActive] = useState<ClipCardData | null>(null);

  return (
    <>
      <div className={CLIP_GRID_CLS}>
        {clips.map((c) => (
          <ClipCard key={c.twitchId} clip={c} onSelect={setActive} trending={trending} />
        ))}
      </div>
      <ClipPreviewModal clip={active} onClose={() => setActive(null)} />
    </>
  );
}
