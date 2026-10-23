import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoryCard, ChannelCard } from "@/features/discovery/SourceCards";
import { twitch } from "@/lib/twitch/client";
import { TwitchNotConfiguredError } from "@/lib/twitch/token";

const CATEGORY_GRID_CLS = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-3 gap-y-5";
const GRID_CLS = "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3";

export const metadata = { title: "Explorar" };
export const dynamic = "force-dynamic";

export default async function ExplorarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const term = q?.trim();

  return (
    <AppShell crumbs={[{ label: "Explorar" }]}>
      <PageHeader
        title="Explorar"
        subtitle="Busca unificada de jogos e streamers na Twitch. Resultados separados por tipo."
      />

      {!term ? (
        <EmptyState
          icon="search"
          title="Comece uma busca"
          description="Use a busca no topo: digite um jogo (ex.: GTA 6), um streamer ou cole um link da Twitch."
        />
      ) : (
        <SearchResults term={term} />
      )}
    </AppShell>
  );
}

async function SearchResults({ term }: { term: string }) {
  try {
    const [cats, channels] = await Promise.all([
      twitch.searchCategories(term, 12),
      twitch.searchChannels(term, 12),
    ]);

    const hasResults = cats.data.length > 0 || channels.data.length > 0;
    if (!hasResults) {
      return (
        <EmptyState
          icon="search"
          title={`Nenhum resultado para “${term}”`}
          description="Tente outro termo. Mostramos apenas o que a Twitch retorna de fato."
        />
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {cats.data.length > 0 && (
          <section>
            <h2 className="text-base mb-3 text-fg">Jogos / categorias</h2>
            <div className={CATEGORY_GRID_CLS}>
              {cats.data.map((c) => (
                <CategoryCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  boxArtUrl={c.box_art_url}
                />
              ))}
            </div>
          </section>
        )}
        {channels.data.length > 0 && (
          <section>
            <h2 className="text-base mb-3 text-fg">Streamers</h2>
            <div className={GRID_CLS}>
              {channels.data.map((ch) => (
                <ChannelCard
                  key={ch.id}
                  login={ch.broadcaster_login}
                  displayName={ch.display_name}
                  thumbnailUrl={ch.thumbnail_url}
                  gameName={ch.game_name}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  } catch (err) {
    const configIssue = err instanceof TwitchNotConfiguredError;
    return (
      <EmptyState
        icon="search"
        title={
          configIssue
            ? "Integração Twitch não configurada"
            : "Não foi possível buscar agora"
        }
        description={
          configIssue
            ? "Defina TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET no .env para habilitar a busca."
            : "A Twitch pode estar instável ou com limite de requisições. Tente novamente em instantes."
        }
      />
    );
  }
}
