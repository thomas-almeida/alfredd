import { getSession } from "@/lib/auth";
import { resolveClipMp4 } from "@/lib/twitch/resolve-clip";

export const runtime = "nodejs";

/** URL assinada da Twitch por clipe; renovada antes de o token expirar. */
const cache = new Map<string, { url: string; at: number }>();
const TTL = 10 * 60 * 1000;

async function mp4Url(id: string, fresh = false) {
  const hit = cache.get(id);
  if (!fresh && hit && Date.now() - hit.at < TTL) return hit.url;
  const { url } = await resolveClipMp4(id);
  cache.set(id, { url, at: Date.now() });
  return url;
}

const PASS = ["content-type", "content-length", "content-range", "accept-ranges"];

/**
 * Proxy em streaming do MP4 do clipe (com Range), servido na mesma origem para
 * o editor (canvas) e o export (fetch no worker) driblarem a falta de CORS da
 * CDN da Twitch. Nada é armazenado.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSession())) return new Response("unauthenticated", { status: 401 });
  const { id } = await params;
  const range = req.headers.get("range");
  const pull = async (fresh: boolean) =>
    fetch(await mp4Url(id, fresh), {
      headers: range ? { Range: range } : {},
      cache: "no-store",
      signal: req.signal,
    });

  let upstream: Response;
  try {
    upstream = await pull(false);
    if (upstream.status === 403 || upstream.status === 401) upstream = await pull(true);
  } catch {
    return new Response("resolve_failed", { status: 502 });
  }
  if (!upstream.ok) return new Response(`upstream_${upstream.status}`, { status: 502 });

  const headers = new Headers({ "Cache-Control": "private, max-age=600" });
  for (const h of PASS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
