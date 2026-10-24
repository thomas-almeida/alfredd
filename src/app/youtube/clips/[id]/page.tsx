import { notFound, redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { YoutubeTranscriptClipper } from "@/features/youtube/YoutubeTranscriptClipper";

export const dynamic = "force-dynamic";

export default async function YoutubeClipPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;
  if (!session) redirect(`/entrar?next=/youtube/clips/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.from("youtube_saved_videos").select("id, video_id, title, channel_title, duration_ms, start_ms, end_ms").eq("id", id).single();
  if (!data) notFound();
  return <AppShell crumbs={[{ label: "YouTube", href: "/youtube" }, { label: "Transcrição" }]}>
    <PageHeader title={data.title} subtitle={`${data.channel_title ?? "YouTube"} · selecione um trecho pela transcrição`} />
    <YoutubeTranscriptClipper saved={{ id: data.id, videoId: data.video_id, title: data.title, channelTitle: data.channel_title, durationMs: data.duration_ms, startMs: data.start_ms, endMs: data.end_ms }} />
  </AppShell>;
}
