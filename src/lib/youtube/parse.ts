// Interpreta o que o usuário cola: link de vídeo, Short, ID, link de canal, @handle.

export type VideoRef = { videoId: string };
export type ChannelRef =
  | { kind: "id"; value: string } // UCxxxxxxxxxxxxxxxxxxxxxx
  | { kind: "handle"; value: string } // @nome
  | { kind: "username"; value: string } // /user/nome (legado)
  | { kind: "custom"; value: string }; // /c/nome (sem endpoint direto na API)

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

function toUrl(input: string): URL | null {
  const s = input.trim();
  if (!/[./]/.test(s)) return null;
  try {
    return new URL(/^https?:\/\//.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
}

export function parseVideo(input: string): VideoRef | null {
  const s = input.trim();
  if (VIDEO_ID.test(s)) return { videoId: s };
  const u = toUrl(s);
  if (!u) return null;
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  let id: string | null | undefined;
  if (host === "youtu.be") id = parts[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") id = u.searchParams.get("v");
    else if (["shorts", "embed", "live", "v", "e"].includes(parts[0] ?? "")) id = parts[1];
  }
  return id && VIDEO_ID.test(id) ? { videoId: id } : null;
}

export function parseChannel(input: string): ChannelRef | null {
  const s = input.trim();
  if (CHANNEL_ID.test(s)) return { kind: "id", value: s };
  if (/^@[\w.\-·]{3,30}$/u.test(s)) return { kind: "handle", value: s };
  const u = toUrl(s);
  if (!u) return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  if (host !== "youtube.com") return null;
  const [a, b] = u.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (!a) return null;
  if (a.startsWith("@")) return { kind: "handle", value: a };
  if (a === "channel" && b && CHANNEL_ID.test(b)) return { kind: "id", value: b };
  if (a === "user" && b) return { kind: "username", value: b };
  if (a === "c" && b) return { kind: "custom", value: b };
  return null;
}
