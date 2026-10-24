import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { SearchBox } from "@/features/discovery/SearchBox";
import { RecommendedClips } from "@/features/clips/RecommendedClips";
import { FeaturedStreamers } from "@/features/discovery/FeaturedStreamers";
import { getRecommendedClips } from "@/lib/twitch/recommendations";

export const dynamic = "force-dynamic";

const destaques = [
  { nome: "GTA 6", tipo: "jogo", href: "/explorar?q=GTA%206" },
  { nome: "Grand Theft Auto V", tipo: "jogo", href: "/explorar?q=GTA%20V" },
  { nome: "Just Chatting", tipo: "jogo", href: "/explorar?q=Just%20Chatting" },
  { nome: "League of Legends", tipo: "jogo", href: "/explorar?q=League%20of%20Legends" },
];

export default async function HomePage() {
  const recommended = await getRecommendedClips(8);

  return (
    <AppShell>
      <section className="py-12 pb-8 max-w-[760px] mx-auto text-center flex flex-col items-center">
        <Badge tone="accent">Seu Mordomo de Clipes</Badge>
        <h1 className="text-6xl font-thin tracking-tighter px-2 mt-4">
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

      {recommended.length > 0 && (
        <section className="mt-12 mx-auto max-w-[1080px]">
          <div className="text-center mb-5">
            <h2 className="text-2xl font-bold">Em Alta para Clipar Agora</h2>
            <p className="text-muted text-[13px] mt-2">
              Clipes mais vistos da semana. Clique para assistir e salve para
              editar depois.
            </p>
          </div>
          <RecommendedClips clips={recommended} />
        </section>
      )}
    </AppShell>
  );
}
