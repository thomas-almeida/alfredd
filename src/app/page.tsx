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
        <Badge tone="accent">Radar de Clipes</Badge>
        <h1 className="text-[clamp(1.9rem,4vw,3rem)] font-bold tracking-tight mt-4">
          Descubra os melhores momentos antes que viralizem.
        </h1>
        <p className="text-muted text-base mt-4 max-w-[60ch]">
          Encontre clipes relevantes de jogos e streamers, compare desempenho
          com o ClipScore, organize sua biblioteca e seja avisado de novas
          oportunidades. Explore sem precisar criar conta.
        </p>
        <div className="mt-8 w-full flex justify-center">
          <SearchBox size="lg" />
        </div>

        <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
          <span className="text-[13px] text-subtle">Comece por</span>
          <div className="flex gap-2 flex-wrap">
            {destaques.map((d) => (
              <Link
                key={d.nome}
                href={d.href}
                className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-full bg-surface text-[13px] text-fg hover:border-border-strong hover:bg-surface-2"
              >
                <span
                  className={cn(
                    "w-[7px] h-[7px] rounded-full",
                    d.tipo === "streamer" ? "bg-info" : "bg-accent",
                  )}
                  aria-hidden
                />
                {d.nome}
              </Link>
            ))}
          </div>
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
