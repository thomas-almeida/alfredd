import { FeaturedStreamers } from "@/features/discovery/FeaturedStreamers";
import { LandingPageCta } from "./LandingPageCta";
import { LpNotificationTicker } from "./LpNotificationTicker";
import { LpVideo } from "./LpVideo";
import { LpNotifyLeadCapture } from "./LpNotifyLeadCapture";

const faqs = [
  ["Preciso ter o jogo para começar?", "Não. Você pode acompanhar os canais e encontrar os melhores momentos mesmo sem ter o jogo. A ideia é transformar o conteúdo validado em oportunidades de publicação."],
  ["Pra quem é a ferramenta?", "Para criadores, editores e pessoas que querem construir audiência com cortes de GTA VI sem passar horas procurando momentos em lives e vídeos longos."],
  ["O grupo é gratuito?", "Sim. O grupo VIP é a porta de entrada para os primeiros criadores e para os avisos de acesso à plataforma."],
  ["Como recebo o acesso?", "Preencha seus dados no botão da página. Em seguida, você será levado para o WhatsApp com as instruções do grupo."],
  ["Preciso saber editar?", "Não. A Alfredd aponta os melhores momentos e o editor já deixa o trecho pronto para você ajustar, legendar e publicar."],
];

const steps = [
  ["01", "Escolha os canais", "Acompanhe os criadores que estão movimentando conteúdo validado."],
  ["02", "Pegue direto do jogo", "Escolha entre centenas de criadores do Brasil ou da gringa pra postar cortes"],
  ["03", "Editor Dinâmico", "Pegue os melhores momentos, edite com a sua cara e poste em menos de 5 minutos."],
  ["04", "Receba clipes no WhatsApp", "Sem precisar caçar nada, apenas receba na palma da sua mão clipes frescos prontos pra postar."]
];

function PlayIcon() {
  return (
    <span className="lp-pink-surface flex h-10 w-10 items-center justify-center rounded-full">
      ▶
    </span>
  );
}

const messages = [
  "Eai? vai perder essa oportunidade de ganhar dinheiro com GTA VI?",
  "Eai? Bora ganhar dinheiro com GTA VI? 😎",
  "Se não entrar agora vai ficar pra trás",
  "Bora lucrar com GTA?"
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
      <LpNotifyLeadCapture message={messages[Math.floor(Math.random() * messages.length)] || "Eai? vai perder essa oportunidade de ganhar dinheiro com GTA VI?"} />
      <LpNotificationTicker />
      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 sm:px-8 lg:px-10 lg:pb-24 lg:pt-28">
        <div className="lp-orb lp-orb-one" />
        <div className="lp-orb lp-orb-two" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="lp-reveal lp-badge mb-6 inline-flex items-center gap-2 rounded-lg border font-black px-4 py-2 text-[14px] tracking-tighter">
            <span className="lp-badge-dot h-1.5 w-1.5 animate-pulse rounded-full" />
            FALTAM 09 DIAS!
          </div>

          <h1 className="lp-reveal lp-delay-1 mx-auto max-w-4xl md:text-6xl font-bold leading-[.96]">
            <p className="text-xl">O Mapa Definitivo para lucrar com <span className="lp-pink-text">GTA VI NA PALMA DA SUA MÃO</span>.</p>
            <p className="font-pricedown lp-pink-text text-6xl">+10.000 HORAS</p>
            <p className="text-xl">De cortes exclusivos direto dos maiores criadores</p>
          </h1>

          <p className="lp-reveal lp-delay-2 mx-auto mt-7 max-w-2xl leading-4 text-white sm:text-lg">
            O GTA VI vai quebrar a internet, e não é possivel que você vai ficar de fora 🎬, até preguiçosos vão ganhar dinheiro com esse método 👇🏻.
          </p>

          <div className="mx-auto mt-12 max-w-7xl">
            <FeaturedStreamers hideHeader showClips={false} />
          </div>

          <div className="lp-reveal lp-delay-3 mt-9 flex flex-col items-center justify-center gap-3">
            <LandingPageCta />
            <span className="text-xs font-bold">RESTAM POUCOS ACESSOS!</span>
          </div>
        </div>

        <div className="lp-reveal lp-delay-4 mt-14">
          <h2 className="lp-reveal lp-delay-4 text-center text-3xl font-bold tracking-tighter sm:text-5xl">Gere Cortes Como Esse Com 2 Cliques 👇🏻</h2>
          <div className="lp-video-wall relative mx-auto mt-5 grid max-w-4xl grid-cols-3 gap-2 sm:gap-4 lg:mt-20">
            {["video-1.mp4", "video-2.mp4", "video-3.mp4"].map((video, index) => (
              <div key={video} className={`lp-video-card ${index === 1 ? "sm:-translate-y-5" : ""}`}>
                <LpVideo src={`/lp-videos/${video}`} label={["Momento encontrado", "Corte em destaque", "Pronto para publicar"][index] ?? "Vídeo em destaque"} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-3 text-xs font-medium">
                  <span>{["2M de views", "657 Mil views", "834 Mil views"][index]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[.06] bg-[var(--lp-surface)] py-20 sm:py-28" id="como-funciona">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <p className="lp-pink-text mb-4 text-center text-xs font-semibold uppercase tracking-tighter">Você não precisa procurar sozinho</p>
          <h2 className="mx-auto max-w-3xl text-center text-3xl font-bold tracking-tighter sm:text-5xl">Enquanto todo mundo assiste, você já está preparando o próximo post.</h2>

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {steps.map(([number, title, text], index) => {
              const [image, imageAlt] = stepImages[index] ?? stepImages[0];

              return (
                <article key={number} className="lp-step group overflow-hidden p-0">
                  <img src={image} alt={imageAlt} className="h-[250px] w-full object-cover object-center rounded-md shadow-2xl border border-slate-700 opacity-90 transition duration-500 group-hover:opacity-100" />
                  <div className="p-6">
                    <span className="lp-pink-text text-sm font-mono">{number}</span>
                    <h3 className="mt-8 text-xl font-semibold">{title}</h3>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">{text}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28" id="criadores">
        <p className="lp-pink-text mb-3 text-center text-xs font-bold uppercase tracking-[.25em]">Conteúdo Viral Infinito</p>
        <h2 className="mx-auto max-w-3xl px-5 text-center text-3xl font-bold tracking-tight sm:text-5xl">Todos em um só lugar te mandando conteúdo validado de GTA VI</h2>
        <p className="mx-auto mt-5 max-w-xl px-5 text-center text-sm leading-6 text-zinc-400">Chega de procurar packs de conteúdo, aqui os criadores trabalham pra você.</p>
        <div className="mx-auto mt-12 max-w-7xl">
          <FeaturedStreamers hideHeader showClips={false} />
        </div>
      </section>

      <section className="lp-cta-section px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.25em] opacity-60">Seu próximo corte começa aqui</p>
            <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-tight tracking-[-.04em] sm:text-6xl">Pare de chegar atrasado no conteúdo.</h2>
            <p className="mt-5 max-w-xl text-base leading-7 opacity-75">Entre para o grupo VIP e seja um dos primeiros criadores a testar a nova forma de encontrar os melhores momentos de GTA VI.</p>
          </div>
          <LandingPageCta />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-28">
        <p className="lp-pink-text text-center text-xs font-semibold uppercase tracking-[.25em]">Perguntas frequentes</p>
        <h2 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-5xl">Antes de entrar</h2>

        <div className="mt-12 space-y-3">
          {faqs.map(([question, answer]) => (
            <details key={question} className="lp-faq group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                <span>{question}</span>
                <span className="lp-pink-text text-xl transition group-open:rotate-45">+</span>
              </summary>
              <p className="pt-4 text-sm leading-6 text-zinc-400">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/[.06] px-5 py-8 text-center text-xs text-zinc-500">
        <span className="font-semibold text-zinc-300">alfredd</span> · conteúdo que chega antes
      </footer>
    </main>
  );
}
