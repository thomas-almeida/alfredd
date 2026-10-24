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
import { twitch, type TwitchClip } from "@/lib/twitch/client";
import { loadBroadcasters, broadcasterInfo } from "@/lib/twitch/broadcasters";
import { TwitchNotConfiguredError } from "@/lib/twitch/token";

export const dynamic = "force-dynamic";

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Com filtro de idioma, pagina mais fundo (até 4 páginas) para sobrar clipes
 *  suficientes depois de descartar os de outros idiomas. */
async function loadGameClips(gameId: string, lang: string) {
  const startedAt = daysAgoISO(7);
  const maxPages = lang ? 4 : 1;
  const data: TwitchClip[] = [];
  let after: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const page = await twitch.clipsByGame(gameId, { first: 100, after, startedAt });
    data.push(...page.data.filter((c) => matchesLanguage(c.language, lang)));
    after = page.pagination?.cursor;
    if (!after || data.length >= 50) break;
  }
  return { data: data.slice(0, 50) };
}

export default async function JogoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const { sort = "recentes", lang: langParam } = await searchParams;
  const lang = await getClipLanguage(langParam);

  let gameName = "Categoria";
  let boxArt: string | null = null;
  let clips: ClipCardData[] = [];
  let errorKind: "config" | "fetch" | null = null;

  try {
    const [gameRes, clipsRes] = await Promise.all([
      twitch.gamesByIds([slug]),
      loadGameClips(slug, lang),
    ]);
    const g = gameRes.data[0];
    if (g) {
      gameName = g.name;
      boxArt = g.box_art_url;
    }
    const owners = await loadBroadcasters(clipsRes.data);
    clips = clipsRes.data.map((c) => ({
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
      clips.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else {
      clips.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));
    }
  } catch (err) {
    errorKind = err instanceof TwitchNotConfiguredError ? "config" : "fetch";
  }

  return (
    <AppShell
      crumbs={[
        { label: "Explorar", href: "/explorar" },
        { label: "Jogos" },
        { label: gameName },
      ]}
    >
      <PageHeader
        title={gameName}
        badges={<Badge tone="accent">Jogo</Badge>}
        subtitle="Clipes dos últimos 7 dias. “Mais recentes” reordena por data (a Twitch retorna por visualizações)."
        actions={
          <>
            <FavoriteButton
              kind="game"
              twitchId={slug}
              name={gameName}
              boxArtUrl={boxArt}
            />
            <ProActionButton />
          </>
        }
      />

      {errorKind ? (
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
          description="Não há clipes para esta categoria na janela atual. Tente mais tarde."
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
