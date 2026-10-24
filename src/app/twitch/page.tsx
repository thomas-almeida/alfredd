import Link from "next/link";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { TwitchDownloader } from "@/features/twitch-media/TwitchDownloader";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Baixar da Twitch" };
export const dynamic = "force-dynamic";

export default async function TwitchPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const session = await getSession();
  const { url } = await searchParams;

  return (
    <AppShell crumbs={[{ label: "Baixar da Twitch" }]}>
      <PageHeader
        title="Twitch"
        subtitle="Analise clipes e VODs da Twitch com preview, transcrição e destaques para criar cortes."
      />
      {session ? (
        <TwitchDownloader initialUrl={url} />
      ) : (
        <EmptyState
          icon="film"
          title="Entre para baixar da Twitch"
          description="Faça login para baixar clipes e trechos de VODs."
          action={
            <Link href="/entrar?next=/twitch">
              <Button variant="primary">Entrar</Button>
            </Link>
          }
        />
      )}
    </AppShell>
  );
}
