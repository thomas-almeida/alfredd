import { QUOTAS } from "@/lib/permissions/quotas";
import Link from "next/link";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import {
  LibraryItemCard,
  type LibraryItemView,
} from "@/features/library/LibraryItemCard";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export const metadata = { title: "Biblioteca" };
export const dynamic = "force-dynamic";

interface ClipJoin {
  twitch_id: string;
  title: string | null;
  thumbnail_url: string | null;
  latest_view_count: number | null;
  twitch_created_at: string;
  url: string;
}

export default async function BibliotecaPage() {
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
      "id, status, clips(twitch_id, title, thumbnail_url, latest_view_count, twitch_created_at, url)",
    )
    .order("created_at", { ascending: false });

  const items: LibraryItemView[] = (data ?? [])
    .map((row) => {
      const clip = row.clips as unknown as ClipJoin | null;
      if (!clip) return null;
      return {
        id: row.id as string,
        status: row.status,
        twitchId: clip.twitch_id,
        title: clip.title,
        thumbnailUrl: clip.thumbnail_url,
        viewCount: clip.latest_view_count,
        createdAt: clip.twitch_created_at,
        officialUrl: clip.url,
      } satisfies LibraryItemView;
    })
    .filter((x): x is LibraryItemView => x !== null);

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
      {items.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Sua biblioteca está vazia"
          description="Ao salvar um clipe, ele aparece aqui com link oficial e status."
          action={
            <Link href="/explorar">
              <Button variant="primary">Explorar clipes</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3 max-w-[820px]">
          {items.map((item) => (
            <LibraryItemCard key={item.id} item={item} isPro={session.isPro} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
