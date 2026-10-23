export type TwitchLink = { kind: "clip"; slug: string } | { kind: "channel"; login: string };

const RESERVED = new Set(["directory", "videos", "settings", "search", "p", "downloads", "jobs", "turbo", "subscriptions", "inventory", "wallet", "drops"]);

/** Reconhece links de clipe (clips.twitch.tv/X, twitch.tv/canal/clip/X) e de canal (twitch.tv/canal). */
export function parseTwitchLink(input: string): TwitchLink | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);
  if (host === "clips.twitch.tv") {
    const slug = parts[0] === "embed" ? url.searchParams.get("clip") : parts[0];
    return slug ? { kind: "clip", slug } : null;
  }
  if (host !== "twitch.tv") return null;
  if (parts[1] === "clip" && parts[2]) return { kind: "clip", slug: parts[2] };
  const login = parts[0]?.toLowerCase();
  if (login && /^\w{1,25}$/.test(login) && !RESERVED.has(login)) return { kind: "channel", login };
  return null;
}
