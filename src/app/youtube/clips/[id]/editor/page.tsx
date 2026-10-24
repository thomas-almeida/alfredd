import { notFound, redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { ClipEditor } from "@/features/editor/ClipEditor";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function YoutubeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/entrar?next=/youtube/clips/${id}/editor`);
  const supabase = await createClient();
  const { data } = await supabase.from("youtube_saved_videos").select("id, video_id, title, channel_title, duration_ms, start_ms, end_ms").eq("id", id).single();
  if (!data) notFound();
  const durationMs = data.duration_ms ?? data.end_ms ?? 0;
  if (!durationMs) return notFound();
  return <AppShell crumbs={[{ label: "YouTube", href: "/youtube" }, { label: "Transcrição", href: `/youtube/clips/${id}` }, { label: "Editor" }]}>
    <PageHeader title={data.title} subtitle={`${data.channel_title ?? "YouTube"} · editor de corte`} />
    <ClipEditor
      twitchId={data.video_id}
      userId={session.userId}
      title={data.title}
      youtube={{ savedId: data.id, videoId: data.video_id, title: data.title, channel: data.channel_title, durationMs, startMs: data.start_ms, endMs: data.end_ms }}
    />
  </AppShell>;
}
