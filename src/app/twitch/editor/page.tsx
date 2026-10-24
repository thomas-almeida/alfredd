import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ClipEditor, type ExternalEditorInput } from "@/features/editor/ClipEditor";
import { getSession } from "@/lib/auth";
import { parseTwitchUrl } from "@/lib/twitch/media";

export const dynamic = "force-dynamic";

export default async function TwitchEditorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/twitch");
  const query = await searchParams;
  const rawUrl = typeof query.url === "string" ? query.url : "";
  const ref = parseTwitchUrl(rawUrl);
  if (!ref) redirect("/twitch");

  const start = Number(query.start ?? 0);
  const end = ref.kind === "vod" ? Number(query.end ?? 0) : Number(query.duration ?? 0);
  const duration = ref.kind === "vod" ? end - start : Number(query.duration ?? 0);
  if (!Number.isFinite(duration) || duration <= 0 || (ref.kind === "vod" && (!Number.isFinite(start) || !Number.isFinite(end) || end <= start))) redirect("/twitch");

  const source = new URL("/api/twitch/download", "http://localhost");
  source.searchParams.set("url", rawUrl);
  source.searchParams.set("dl", "0");
  if (ref.kind === "vod") {
    source.searchParams.set("start", String(start));
    source.searchParams.set("end", String(end));
  }
  const selectedStart = ref.kind === "clip" && Number.isFinite(start) ? start : 0;
  const selectedEnd = ref.kind === "clip" && Number.isFinite(Number(query.end)) ? Number(query.end) : duration;
  const input: ExternalEditorInput = {
    sourceUrl: `${source.pathname}${source.search}`,
    transcriptUrl: rawUrl,
    transcriptWindow: ref.kind === "vod" ? { startMs: start * 1000, endMs: end * 1000 } : undefined,
    title: typeof query.title === "string" ? query.title : "Twitch",
    channel: typeof query.channel === "string" ? query.channel : null,
    durationMs: duration * 1000,
    startMs: selectedStart * 1000,
    endMs: selectedEnd * 1000,
  };

  return <AppShell wide crumbs={[{ label: "Twitch", href: "/twitch" }, { label: "Editor" }]}>
    <ClipEditor twitchId="external" userId={session.userId} title={input.title} external={input} />
  </AppShell>;
}
