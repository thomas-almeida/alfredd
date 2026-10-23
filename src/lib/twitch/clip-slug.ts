/**
 * Extrai o slug de um clipe a partir da URL (ou devolve o próprio valor se já
 * for um slug). Aceita:
 *  - https://www.twitch.tv/{canal}/clip/{slug}
 *  - https://clips.twitch.tv/{slug}
 *  - https://clips.twitch.tv/embed?clip={slug}
 *  - https://m.twitch.tv/clip/{slug}
 */
export function parseClipSlug(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (/^[A-Za-z0-9_-]+$/.test(v)) return v;

  let url: URL;
  try {
    url = new URL(v.includes("://") ? v : `https://${v}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "clips.twitch.tv") {
    if (parts[0] === "embed") return url.searchParams.get("clip");
    return parts[0] ?? null;
  }
  if (host === "twitch.tv") {
    const i = parts.indexOf("clip");
    return i >= 0 ? (parts[i + 1] ?? null) : null;
  }
  return null;
}

/** Canal (login) a partir de twitch.tv/{canal}/clip/{slug}; null se ausente. */
export function parseClipChannel(input: string): string | null {
  try {
    const url = new URL(input);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[1] === "clip" && parts[0] ? parts[0].toLowerCase() : null;
  } catch {
    return null;
  }
}

export interface ClipQuality {
  quality: string;
  sourceURL: string;
  frameRate?: number;
}

/** Melhor qualidade com altura ≤ maxHeight (padrão 1080p); desempata por fps. */
export function pickBestQuality(
  qualities: ClipQuality[],
  maxHeight = 1080,
): ClipQuality | null {
  const ranked = qualities
    .map((q) => ({ q, h: Number.parseInt(q.quality, 10) || 0 }))
    .filter((x) => x.h > 0 && x.h <= maxHeight)
    .sort((a, b) => b.h - a.h || (b.q.frameRate ?? 0) - (a.q.frameRate ?? 0));
  return ranked[0]?.q ?? null;
}
