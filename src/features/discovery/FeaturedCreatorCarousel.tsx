"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type FeaturedCarouselCreator = {
  key: string;
  name: string;
  avatar: string | null;
  platform: "twitch" | "youtube";
  href: string;
};

const STEP_PX = 208;
const TRANSITION_MS = 520;
const STEP_INTERVAL_MS = 2_800;

function CreatorCard({ creator }: { creator: FeaturedCarouselCreator }) {
  return (
    <Link
      href={creator.href}
      className="group flex w-48 shrink-0 items-center gap-3 rounded-xl border border-border bg-surface/80 p-3 shadow-sm transition hover:-translate-y-1 hover:border-accent/60 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${creator.name} — ${creator.platform === "twitch" ? "Twitch" : "YouTube"}`}
    >
      {creator.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={creator.avatar} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-border transition group-hover:ring-accent" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl font-bold text-accent ring-2 ring-border">
          {creator.name[0]?.toUpperCase() ?? "?"}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-fg">{creator.name}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={creator.platform === "twitch" ? "/twitch.svg" : "/youtube.svg"} alt="" className="h-3.5 w-3.5 object-contain" />
          {creator.platform === "twitch" ? "Twitch" : "YouTube"}
        </span>
      </span>
    </Link>
  );
}

function CarouselRow({ creators, direction }: { creators: FeaturedCarouselCreator[]; direction: "left" | "right" }) {
  const initial = useMemo(
    () => direction === "right" && creators.length > 1 ? [creators.at(-1)!, ...creators.slice(0, -1)] : creators,
    [creators, direction],
  );
  const [items, setItems] = useState(initial);
  const [offset, setOffset] = useState(direction === "right" && creators.length > 1 ? -STEP_PX : 0);
  const [transition, setTransition] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setItems(initial);
    setTransition(false);
    setOffset(direction === "right" && creators.length > 1 ? -STEP_PX : 0);
  }, [initial, direction, creators.length]);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = window.setInterval(() => {
      setTransition(true);
      setOffset(direction === "left" ? -STEP_PX : 0);
      window.setTimeout(() => {
        setTransition(false);
        setItems((current) => direction === "left"
          ? [...current.slice(1), current[0]!]
          : [current.at(-1)!, ...current.slice(0, -1)]);
        setOffset(direction === "left" ? 0 : -STEP_PX);
      }, TRANSITION_MS);
    }, STEP_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [direction, items.length, paused]);

  if (items.length === 0) return null;
  return (
    <div
      className="relative w-full overflow-hidden py-1 before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-24 before:bg-gradient-to-r before:from-bg before:to-transparent after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-24 after:bg-gradient-to-l after:from-bg after:to-transparent"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex w-max gap-4 px-4"
        style={{ transform: `translateX(${offset}px)`, transition: transition ? `transform ${TRANSITION_MS}ms linear` : "none" }}
      >
        {items.map((creator) => <CreatorCard key={creator.key} creator={creator} />)}
      </div>
    </div>
  );
}

export function FeaturedCreatorCarousel({ rows }: { rows: FeaturedCarouselCreator[][] }) {
  return (
    <div className="relative flex w-full flex-col gap-3 py-2">
      <CarouselRow creators={rows[0] ?? []} direction="left" />
      <CarouselRow creators={rows[1] ?? []} direction="right" />
    </div>
  );
}
