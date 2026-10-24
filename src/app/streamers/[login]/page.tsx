import Link from "next/link";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ProActionButton } from "@/features/billing/ProActionButton";
import { Badge } from "@/components/ui/Badge";
import { RecommendedClips } from "@/features/clips/RecommendedClips";
import { FeedSort } from "@/features/clips/FeedSort";
import { LanguageFilter } from "@/features/clips/LanguageFilter";
import { matchesLanguage } from "@/lib/twitch/languages";
import { getClipLanguage } from "@/lib/twitch/clipLanguage.server";
import { FavoriteButton } from "@/features/favorites/FavoriteButton";
import type { ClipCardData } from "@/features/clips/ClipCard";
import { twitch } from "@/lib/twitch/client";
import { broadcasterInfo } from "@/lib/twitch/broadcasters";
import { TwitchNotConfiguredError } from "@/lib/twitch/token";

export const dynamic = "force-dynamic";

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export default async function StreamerPage({
  params,
  searchParams,
}: {
  params: Promise<{ login: string }>;
  searchParams: Promise<{ sort?: string; lang?: string }>;
}) {
  const { login } = await params;
  const { sort = "recentes", lang: langParam } = await searchParams;
  const lang = await getClipLanguage(langParam);

  let displayName = login;
  let twitchUserId: string | null = null;
  let avatar: string | null = null;
  let clips: ClipCardData[] = [];
  let errorKind: "config" | "fetch" | "notfound" | null = null;

  try {
    const users = await twitch.usersByLogin([login]);
    const u = users.data[0];
    if (!u) {
      errorKind = "notfound";
    } else {
      displayName = u.display_name;
      twitchUserId = u.id;
      avatar = u.profile_image_url;
      // A Helix ordena os clipes de um período por visualizações, não por data.
      // Para "Mais recentes", consultamos janelas curtas (as mais novas primeiro)
      // e mesclamos; assim os clipes de hoje não ficam de fora pelos mais vistos do mês.
      const windows =
        sort === "recentes"
          ? ([[0, 1], [1, 3], [3, 7], [7, 14], [14, 30]] as const)
          : ([[0, 30]] as const);
      const pages = await Promise.all(
        windows.map(([to, from]) =>
          twitch.clipsByBroadcaster(u.id, {
            first: 50,
            startedAt: daysAgoISO(from),
            endedAt: daysAgoISO(to),
          }),
        ),
      );
      const seen = new Set<string>();
      const raw = pages
        .flatMap((p) => p.data)
        .filter((c) => !seen.has(c.id) && seen.add(c.id))
        .filter((c) => matchesLanguage(c.language, lang));
      const owners = new Map([[u.id, { login: u.login, avatar: u.profile_image_url }]]);
      clips = raw.map((c) => ({
        twitchId: c.id,
        title: c.title,
        broadcasterName: c.broadcaster_name,
        ...broadcasterInfo(owners, c.broadcaster_id),
        thumbnailUrl: c.thumbnail_url,
        viewCount: c.view_count,
        durationSeconds: c.duration,
        createdAt: c.created_at,
        score: { value: null, status: "insuficiente" as const },
      }));
      if (sort === "recentes") {
        clips = clips
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 60);
      } else {
        clips.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
      }
    }
  } catch (err) {
    errorKind = err instanceof TwitchNotConfiguredError ? "config" : "fetch";
  }

  return (
    <AppShell
      crumbs={[
        { label: "Explorar", href: "/explorar" },
        { label: "Streamers" },
        { label: displayName },
      ]}
    >
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                width={44}
                height={44}
                className="w-11 h-11 rounded-full border border-border-strong"
              />
            )}
            {displayName}
          </span>
        }
        badges={<Badge tone="info">Streamer</Badge>}
        subtitle="Clipes dos últimos 30 dias deste canal."
        actions={
          twitchUserId ? (
            <>
              <FavoriteButton
                kind="streamer"
                twitchId={twitchUserId}
                login={login}
                displayName={displayName}
                thumbnailUrl={avatar}
              />
              <ProActionButton />
            </>
          ) : undefined
        }
      />

      {errorKind === "notfound" ? (
        <EmptyState
          icon="star"
          title="Streamer não encontrado"
          description={`Não encontramos o canal “${login}” na Twitch.`}
        />
      ) : errorKind ? (
        <EmptyState
          icon="film"
          title={
            errorKind === "config"
              ? "Integração Twitch não configurada"
              : "Não foi possível carregar os clipes"
          }
          description={
            errorKind === "config"
              ? "Defina TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no .env."
              : "Tente novamente em instantes."
          }
        />
      ) : clips.length === 0 && !lang ? (
        <EmptyState
          icon="film"
          title="Nenhum clipe recente"
          description="Este canal não tem clipes na janela atual."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <FeedSort current={sort} />
            <LanguageFilter current={lang} />
          </div>
          {clips.length === 0 ? (
            <EmptyState
              icon="film"
              title="Nenhum clipe neste idioma"
              description="Escolha outro idioma ou volte para “Todos os idiomas”."
            />
          ) : (
            <RecommendedClips clips={clips} trending={false} />
          )}
        </>
      )}
    </AppShell>
  );
}
