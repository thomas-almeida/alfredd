// Cliente mínimo do GQL público da Twitch (o mesmo que o site twitch.tv usa).
// Toda a dependência "não oficial" fica isolada aqui: se a Twitch mudar algo,
// só este arquivo precisa ser ajustado.

export const TWITCH_GQL = "https://gql.twitch.tv/gql";

// Client-ID público do player web da Twitch. Pode ser sobrescrito por env.
export const TWITCH_CLIENT_ID = process.env.TWITCH_WEB_CLIENT_ID ?? "kimne78kx3ncx6brgo4mv6wki5h1ko";

export class TwitchError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status = 502, detail?: unknown) {
    super(message);
    this.name = "TwitchError";
    this.status = status;
    this.detail = detail;
  }
}

export async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(TWITCH_GQL, {
    method: "POST",
    headers: { "Client-ID": TWITCH_CLIENT_ID, "Content-Type": "text/plain" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new TwitchError(`GQL HTTP ${res.status}`, 502);
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new TwitchError(`GQL: ${json.errors.map((e) => e.message).join("; ")}`, 502, json.errors);
  }
  if (!json.data) throw new TwitchError("GQL sem dados", 502);
  return json.data;
}

export type TwitchRef = { kind: "clip"; slug: string } | { kind: "vod"; id: string };

/** Extrai slug de clip ou id de VOD de qualquer formato de link comum. */
export function parseTwitchUrl(input: string): TwitchRef | null {
  const s = input.trim();
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s.startsWith("http") ? s : `https://${s}`);
  } catch {
    // slug puro
    return /^[A-Za-z0-9_-]{10,}$/.test(s) ? { kind: "clip", slug: s } : null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  const first = parts[0];

  if (host === "clips.twitch.tv" && first) {
    if (first !== "embed") return { kind: "clip", slug: first };
    const slug = u.searchParams.get("clip");
    return slug ? { kind: "clip", slug } : null;
  }
  if (host === "twitch.tv") {
    // twitch.tv/{canal}/clip/{slug}
    const ci = parts.indexOf("clip");
    const slug = ci >= 0 ? parts[ci + 1] : undefined;
    if (slug) return { kind: "clip", slug };
    // twitch.tv/videos/{id}
    const vi = parts.indexOf("videos");
    const id = vi >= 0 ? parts[vi + 1] : undefined;
    if (id && /^\d+$/.test(id)) return { kind: "vod", id };
  }
  // Sem host reconhecido: "abc..." vira https://abc... — trata como slug puro.
  if (!s.includes("/") && !s.includes(".") && /^[A-Za-z0-9_-]{10,}$/.test(s)) return { kind: "clip", slug: s };
  return null;
}
