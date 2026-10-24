import Link from "next/link";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { YoutubeEngagement } from "@/features/youtube/YoutubeEngagement";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Engajamento YouTube" };
export const dynamic = "force-dynamic";

export default async function YoutubePage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const session = await getSession();
  const { channel } = await searchParams;

  return (
    <AppShell crumbs={[{ label: "Engajamento YouTube" }]}>
      <PageHeader
        title="YouTube"
        subtitle="Acompanhe a viralização de um vídeo ou criador para clipar em cima dos conteúdos e pegar cortes antecipados da concorrência."
      />
      {session ? (
        <YoutubeEngagement initialChannel={channel} />
      ) : (
        <EmptyState
          icon="eye"
          title="Entre para medir o engajamento"
          description="Faça login para consultar a taxa de engajamento de vídeos e canais do YouTube."
          action={
            <Link href="/entrar?next=/youtube">
              <Button variant="primary">Entrar</Button>
            </Link>
          }
        />
      )}
    </AppShell>
  );
}
