import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { SearchBox } from "@/features/discovery/SearchBox";
import { FeaturedStreamers } from "@/features/discovery/FeaturedStreamers";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <AppShell>
      <section className="py-12 pb-8 max-w-[760px] mx-auto text-center flex flex-col items-center">
        <Badge tone="accent">Seu Mordomo de Clipes</Badge>
        <h1 className="text-6xl font-thin tracking-tighter font-serif px-2 mt-4">
          Descubra os melhores momentos antes que viralizem.
        </h1>
        <p className="text-muted text-base mt-4 max-w-[60ch]">
          Encontre clipes relevantes dos criadores e jogos que estão em alto, compare desempenho, organize sua biblioteca e faça cortes antes da concorrência
        </p>
        <div className="mt-8 w-full flex justify-center">
          <SearchBox size="lg" />
        </div>
      </section>

      <FeaturedStreamers />
    </AppShell>
  );
}
