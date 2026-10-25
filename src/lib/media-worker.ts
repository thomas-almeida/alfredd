import "server-only";

export function mediaWorkerUrl(): string | null {
  const value = process.env.MEDIA_WORKER_URL?.trim().replace(/\/$/, "");
  return value || null;
}

export async function proxyMediaWorker(req: Request, path: string): Promise<Response> {
  const base = mediaWorkerUrl();
  if (!base) throw new Error("MEDIA_WORKER_URL não configurada");
  const headers = new Headers();
  const secret = process.env.MEDIA_WORKER_SECRET;
  if (secret) headers.set("Authorization", `Bearer ${secret}`);
  const range = req.headers.get("range");
  if (range) headers.set("Range", range);
  const upstream = await fetch(`${base}${path}`, { headers, cache: "no-store", redirect: "manual" });
  const responseHeaders = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control", "location"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
