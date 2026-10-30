"use client";

import { useEffect, useRef } from "react";

export function LpVideo({ src, label }: { src: string; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;

    const tryPlay = () => {
      void video.play().catch(() => {
        // iOS pode bloquear autoplay por economia de energia ou configuração do usuário.
      });
    };

    tryPlay();
    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("canplay", tryPlay);

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-label={label}
    />
  );
}
