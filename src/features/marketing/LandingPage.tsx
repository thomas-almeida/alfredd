import { LandingPageCta } from "./LandingPageCta";
import { LpNotificationTicker } from "./LpNotificationTicker";
import { LpNotifyLeadCapture } from "./LpNotifyLeadCapture";

const messages = [
  {
    picture: "/afiliates/afiliate-1.jpg",
    name: "Lucas",
    message: "Acabou de Garantir a vaga",
  },
  {
    picture: "/afiliates/afiliate-2.jpg",
    name: "Junior",
    message: "Já ta no grupo e ta aplicando o método",
  },
  {
    picture: "/afiliates/afiliate-3.jpg",
    name: "Ingrid",
    message: "2K de Lucro com o Método",
  },
  {
    picture: "/afiliates/afiliate-4.jpg",
    name: "Ana",
    message: "Acabou de Garantir a vaga",
  },
  {
    picture: "/afiliates/afiliate-5.jpg",
    name: "Fernanda",
    message: "Já ta no grupo e ta aplicando o método",
  },
  {
    picture: "/afiliates/afiliate-6.jpg",
    name: "Souza",
    message: "Acabou de Garantir a vaga",
  },
  {
    picture: "/afiliates/afiliate-7.jpg",
    name: "Filipe",
    message: "Já ta no grupo e ta aplicando o método",
  },
  {
    picture: "/afiliates/afiliate-8.jpg",
    name: "Arthur",
    message: "2K de Lucro com o Método",
  }
]

const stepImages = [
  ["/prints/p-creators.png", "Tela de criadores acompanhados"],
  ["/prints/p-games.png", "Tela de clipes organizados por jogo"],
  ["/prints/p-editor.png", "Editor de clipes da Alfredd"],
  ["/prints/p-whatsapp.jpeg", "Notificação de novo clipe no WhatsApp"],
] as const;

export function LandingPage() {
  return (
    <main className="lp-theme min-h-screen overflow-hidden bg-[var(--lp-bg)] text-[var(--lp-fg)]">
      <LpNotifyLeadCapture messages={messages} />
      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 sm:px-8 lg:px-10 lg:pb-24 lg:pt-28">
        <div className="lp-orb lp-orb-one" />
        <div className="lp-orb lp-orb-two" />

        <div className="relative mx-auto max-w-4xl text-center">
          <LpNotificationTicker />

          <h1 className="lp-reveal mt-10 lp-delay-1 mx-auto max-w-4xl md:text-6xl font-bold leading-[.96]">
            <p className="text-xl">O Mapa Definitivo para lucrar com <span className="lp-pink-text">GTA VI NA PALMA DA SUA MÃO</span>.</p>
            <p className="font-pricedown lp-pink-text text-4xl">SEM FAZER NADA</p>
            <p className="text-xl">Tudo explicado no nosso grupo do WhatsApp</p>
          </h1>

          <p className="lp-reveal lp-delay-2 mx-auto mt-7 max-w-2xl leading-4 text-white sm:text-lg">
            O GTA VI vai quebrar a internet, e não é possivel que você vai ficar de fora, até preguiçosos vão ganhar dinheiro com esse método 👇🏻.
          </p>

          <div className="lp-reveal lp-delay-3 mt-9 flex flex-col items-center justify-center gap-3">
            <LandingPageCta />
            <span className="text-xs font-bold">RESTAM POUCOS ACESSOS!</span>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[.06] bg-[var(--lp-surface)] py-20 sm:py-28" id="como-funciona">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <p className="lp-pink-text mb-4 text-center text-xs font-semibold uppercase tracking-tighter">Um Evento Único</p>
          <h2 className="mx-auto max-w-3xl text-center text-3xl font-bold tracking-tighter sm:text-5xl">Bilhões de pessoas estão esperando por isso</h2>
          <p className="lp-reveal text-center lp-delay-2 mx-auto mt-7 max-w-2xl leading-4 text-white sm:text-lg">
            Você vai ter acesso a um método que poucos terão a oportunidade de entrar e conhecer e quem entra no começo bebe água fresca e sai na frente, na época do GTA V você estava de fora, agora é a sua vez!
          </p>
        </div>
      </section>

      <footer className="border-t border-white/[.06] px-5 py-8 text-center text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">GTA VI</span> · O METODO
      </footer>
    </main>
  );
}
