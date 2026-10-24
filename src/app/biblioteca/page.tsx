import { QUOTAS } from "@/lib/permissions/quotas";
import Link from "next/link";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  LibraryItemCard,
  type LibraryItemView,
} from "@/features/library/LibraryItemCard";
import { LibraryFilters, type StreamerOption } from "@/features/library/LibraryFilters";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { twitch } from "@/lib/twitch/client";
import { loadBroadcasters } from "@/lib/twitch/broadcasters";
import type { Highlight } from "@/lib/transcript/client";
import { RemoveSavedSourceButton } from "@/features/library/RemoveSavedSourceButton";

export const metadata = { title: "Biblioteca" };
export const dynamic = "force-dynamic";

interface ClipJoin {
  twitch_id: string;
  title: string | null;
  thumbnail_url: string | null;
  latest_view_count: number | null;
  twitch_created_at: string;
  url: string;
  streamers: { login: string; display_name: string; thumbnail_url: string | null } | null;
  games: { name: string } | null;
}

interface SavedYoutube {
  id: string;
  video_id: string;
  title: string;
  channel_title: string | null;
  thumbnail_url: string | null;
  duration_ms: number | null;
  start_ms: number | null;
  end_ms: number | null;
}

interface SavedVod {
  id: string;
  vod_id: string;
  source_url: string;
  title: string;
  channel: string | null;
  thumbnail_url: string | null;
  length_seconds: number;
  start_seconds: number;
  end_seconds: number;
}

const formatSeconds = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

function HighlightLinks({ highlights, href }: { highlights: Highlight[]; href: (h: Highlight) => string }) {
  if (!highlights.length) return null;
  return <details className="mt-3 border-t border-border pt-3 group">
    <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-medium uppercase tracking-wide text-subtle hover:text-fg [&::-webkit-details-marker]:hidden">
      <span>Destaques salvos ({highlights.length})</span>
      <span className="text-sm transition-transform group-open:rotate-180">⌄</span>
    </summary>
    <div className="mt-2 flex flex-col gap-1.5">
      {highlights.slice(0, 5).map((h) => <Link key={`${h.startMs}-${h.endMs}`} href={href(h)} className="rounded bg-surface-2 px-2 py-1.5 text-xs text-muted hover:text-accent">
        <span className="font-mono text-accent">{formatSeconds(h.startMs / 1000)}–{formatSeconds(h.endMs / 1000)}</span>{h.title ? ` · ${h.title}` : ""}
      </Link>)}
    </div>
  </details>;
}

export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ streamer?: string; jogo?: string; aba?: string }>;
}) {
  const { streamer = "", jogo = "", aba } = await searchParams;
  const session = await getSession();

  if (!session) {
    return (
      <AppShell crumbs={[{ label: "Biblioteca" }]}>
        <PageHeader title="Biblioteca" subtitle="Seus clipes salvos." />
        <EmptyState
          icon="bookmark"
          title="Entre para ver sua biblioteca"
          description="Faça login para salvar e organizar clipes."
          action={
            <Link href="/entrar?next=/biblioteca">
              <Button variant="primary">Entrar</Button>
            </Link>
          }
        />
      </AppShell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("library_items")
    .select(
      "id, clips(twitch_id, title, thumbnail_url, latest_view_count, twitch_created_at, url, streamers(login, display_name, thumbnail_url), games(name))",
    )
    .order("created_at", { ascending: false });

  const [{ data: youtubeSaved }, { data: vodSaved }] = await Promise.all([
    supabase.from("youtube_saved_videos").select("id, video_id, title, channel_title, thumbnail_url, duration_ms, start_ms, end_ms").order("created_at", { ascending: false }),
    supabase.from("twitch_saved_vods").select("id, vod_id, source_url, title, channel, thumbnail_url, length_seconds, start_seconds, end_seconds").order("created_at", { ascending: false }),
  ]);
  const savedYoutubes = (youtubeSaved ?? []) as SavedYoutube[];
  const savedVods = (vodSaved ?? []) as SavedVod[];
  const highlightKeys = [
    ...savedYoutubes.map((v) => `youtube:${v.video_id}`),
    ...savedVods.map((v) => `twitch_vod:${v.vod_id}:${Math.round(v.start_seconds * 1000)}-${Math.round(v.end_seconds * 1000)}`),
  ];
  const { data: highlightRows } = highlightKeys.length
    ? await supabase.from("video_highlights").select("source_key, highlights").in("source_key", highlightKeys)
    : { data: [] as { source_key: string; highlights: unknown }[] };
  const highlightsByKey = new Map((highlightRows ?? []).map((row) => [row.source_key, row.highlights as unknown as Highlight[]]));

  const items: LibraryItemView[] = (data ?? [])
    .map((row) => {
      const clip = row.clips as unknown as ClipJoin | null;
      if (!clip) return null;
      return {
        id: row.id as string,
        twitchId: clip.twitch_id,
        title: clip.title,
        thumbnailUrl: clip.thumbnail_url,
        viewCount: clip.latest_view_count,
        createdAt: clip.twitch_created_at,
        officialUrl: clip.url,
        broadcasterName: clip.streamers?.display_name ?? null,
        broadcasterLogin: clip.streamers?.login ?? null,
        broadcasterAvatar: clip.streamers?.thumbnail_url ?? null,
        gameName: clip.games?.name ?? null,
      } satisfies LibraryItemView;
    })
    .filter((x): x is LibraryItemView => x !== null);

  // Clipes salvos sem streamer no catálogo: completa nome e avatar pela Twitch.
  const missing = items.filter((i) => !i.broadcasterName).map((i) => i.twitchId);
  if (missing.length > 0) {
    try {
      const res = await twitch.clipsByIds(missing.slice(0, 100));
      const owners = await loadBroadcasters(res.data);
      const byClip = new Map(res.data.map((c) => [c.id, c]));
      for (const item of items) {
        const c = byClip.get(item.twitchId);
        if (!c || item.broadcasterName) continue;
        const o = owners.get(c.broadcaster_id);
        item.broadcasterName = c.broadcaster_name;
        item.broadcasterLogin = o?.login ?? null;
        item.broadcasterAvatar = o?.avatar ?? null;
      }
    } catch {
      /* sem dados da Twitch: segue sem streamer */
    }
  }

  // Opções vêm da biblioteca inteira; o filtro só afeta a grade.
  const streamerMap = new Map<string, StreamerOption>();
  for (const i of items)
    if (i.broadcasterName && !streamerMap.has(i.broadcasterName))
      streamerMap.set(i.broadcasterName, { name: i.broadcasterName, avatar: i.broadcasterAvatar });
  const streamers = [...streamerMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const games = [...new Set(items.map((i) => i.gameName).filter((g): g is string => !!g))].sort((a, b) =>
    a.localeCompare(b),
  );
  const visible = items.filter(
    (i) => (!streamer || i.broadcasterName === streamer) && (!jogo || i.gameName === jogo),
  );
  const activeTab = aba === "youtube" || aba === "twitch"
    ? aba
    : items.length || savedVods.length ? "twitch" : "youtube";

  return (
    <AppShell crumbs={[{ label: "Biblioteca" }]}>
      <PageHeader
        title="Biblioteca"
        subtitle={
          session.isPro
            ? "Seus clipes salvos (plano PRO, sem limite artificial)."
            : `Seus clipes salvos. Plano Free: ${items.length}/${QUOTAS.free.savedClips} clipes (sem remoção).`
        }
      />
      {items.length === 0 && savedYoutubes.length === 0 && savedVods.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Sua biblioteca está vazia"
          description="Ao salvar um clipe, ele aparece aqui com link oficial e atalho para o editor."
          action={
            <Link href="/explorar">
              <Button variant="primary">Explorar clipes</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex gap-1 border-b border-border" role="tablist" aria-label="Tipo de conteúdo da biblioteca">
            <Link href="/biblioteca?aba=twitch" role="tab" aria-selected={activeTab === "twitch"} className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "twitch" ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}>
              Clipes da Twitch <span className="ml-1 text-xs text-subtle">{items.length + savedVods.length}</span>
            </Link>
            <Link href="/biblioteca?aba=youtube" role="tab" aria-selected={activeTab === "youtube"} className={`border-b-2 px-4 py-2 text-sm font-medium ${activeTab === "youtube" ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}>
              YouTube <span className="ml-1 text-xs text-subtle">{savedYoutubes.length}</span>
            </Link>
          </div>

          {activeTab === "twitch" ? <>
            <LibraryFilters
              key={`${streamer}|${jogo}`}
              streamers={streamers}
              games={games}
              streamer={streamer}
              game={jogo}
            />
            {visible.length === 0 && savedVods.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">Nenhum clipe da Twitch com esses filtros.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
                {visible.map((item) => <LibraryItemCard key={item.id} item={item} isPro={session.isPro} />)}
                {savedVods.map((vod) => {
                  const key = `twitch_vod:${vod.vod_id}:${Math.round(vod.start_seconds * 1000)}-${Math.round(vod.end_seconds * 1000)}`;
                  const editorBase = `/twitch/editor?url=${encodeURIComponent(vod.source_url)}&duration=${vod.end_seconds - vod.start_seconds}&vodLength=${vod.length_seconds}&title=${encodeURIComponent(vod.title)}&channel=${encodeURIComponent(vod.channel ?? "")}`;
                  const editor = `${editorBase}&start=${vod.start_seconds}&end=${vod.end_seconds}`;
                  return <div key={vod.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
                    {vod.thumbnail_url && <img src={vod.thumbnail_url} alt="" className="aspect-video w-full rounded-md object-cover" />}
                    <span className="text-sm font-semibold text-fg">{vod.title}</span>
                    <span className="text-xs text-muted">VOD · {vod.channel ?? "Canal desconhecido"} · {formatSeconds(vod.end_seconds - vod.start_seconds)}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={editor} className="text-xs text-accent hover:underline">Abrir no editor →</Link>
                      <RemoveSavedSourceButton kind="vod" id={vod.id} isPro={session.isPro} />
                    </div>
                    <HighlightLinks highlights={highlightsByKey.get(key) ?? []} href={(h) => `${editorBase}&start=${(vod.start_seconds * 1000 + h.startMs) / 1000}&end=${(vod.start_seconds * 1000 + h.endMs) / 1000}`} />
                  </div>;
                })}
              </div>
            )}
          </> : (
            savedYoutubes.length === 0 ? <p className="py-8 text-center text-sm text-muted">Nenhum vídeo do YouTube salvo.</p> :
            <div className="grid grid-cols-3 gap-2 max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
              {savedYoutubes.map((video) => {
                const key = `youtube:${video.video_id}`;
                const start = video.start_ms ?? 0;
                const end = video.end_ms ?? video.duration_ms ?? 0;
                return <div key={video.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
                  {video.thumbnail_url && <img src={video.thumbnail_url} alt="" className="aspect-video w-full rounded-md object-cover" />}
                  <Link href={`/youtube/clips/${video.id}`} className="text-sm font-semibold text-fg hover:text-accent">{video.title}</Link>
                  <span className="text-xs text-muted">YouTube · {video.channel_title ?? "Canal desconhecido"} · {formatSeconds((end - start) / 1000)}</span>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href={`/youtube/clips/${video.id}/editor`} className="text-xs text-accent hover:underline">Abrir no editor →</Link>
                    <RemoveSavedSourceButton kind="youtube" id={video.id} isPro={session.isPro} />
                  </div>
                  <HighlightLinks highlights={highlightsByKey.get(key) ?? []} href={(h) => `/youtube/clips/${video.id}/editor?start=${h.startMs}&end=${h.endMs}`} />
                </div>;
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
