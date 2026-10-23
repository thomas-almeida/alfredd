import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { MetricTile } from "@/components/ui/MetricTile";
import { ClipPlayer } from "@/features/clips/ClipPlayer";
import { ClipActions } from "@/features/clips/ClipActions";
import { ClipScoreBadge } from "@/features/clips/ClipScoreBadge";
import { twitch } from "@/lib/twitch/client";
import { formatViews, formatDuration, timeAgo } from "@/lib/twitch/format";

export const dynamic = "force-dynamic";

export default async function ClipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ save?: string }>;
}) {
  const { id } = await params;
  const { save } = await searchParams;

  let clip:
    | {
        id: string;
        title: string;
        url: string;
        broadcaster_name: string;
        view_count: number;
        duration: number;
        created_at: string;
        language: string;
      }
    | null = null;

  try {
    const res = await twitch.clipsByIds([id]);
    const c = res.data[0];
    if (c) {
      clip = {
        id: c.id,
        title: c.title,
        url: c.url,
        broadcaster_name: c.broadcaster_name,
        view_count: c.view_count,
        duration: c.duration,
        created_at: c.created_at,
        language: c.language,
      };
    }
  } catch {
    clip = null;
  }

  if (!clip) {
    return (
      <AppShell crumbs={[{ label: "Clipes" }, { label: id }]}>
        <EmptyState
          icon="film"
          title="Clipe não encontrado"
          description="O clipe pode ter sido removido ou o identificador é inválido."
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumbs={[{ label: "Clipes" }, { label: clip.broadcaster_name }]}>
      <PageHeader
        title={clip.title || "Sem título"}
        subtitle={`Por ${clip.broadcaster_name}`}
        badges={<ClipScoreBadge value={null} status="insuficiente" />}
      />

      <div className="grid grid-cols-[1fr_300px] gap-5 items-start max-[860px]:grid-cols-1">
        <div className="flex flex-col gap-4">
          <ClipPlayer clipId={clip.id} watchUrl={clip.url} />
          <div className="py-2">
            <ClipActions
              twitchId={clip.id}
              officialUrl={clip.url}
              resume={save === "1"}
            />
          </div>
        </div>

        <Card className="flex flex-col gap-2">
          <MetricTile value={formatViews(clip.view_count)} label="Visualizações" />
          <MetricTile value={formatDuration(clip.duration)} label="Duração" />
          <MetricTile value={timeAgo(clip.created_at)} label="Publicado" />
          <MetricTile
            value="—"
            label="ClipScore"
            note="Dados insuficientes: o score exige snapshots de views ao longo do tempo (Fase 2)."
          />
        </Card>
      </div>
    </AppShell>
  );
}
