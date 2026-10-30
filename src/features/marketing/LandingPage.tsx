import { FeaturedStreamers } from "@/features/discovery/FeaturedStreamers";
import { LandingPageCta } from "./LandingPageCta";
import { LpNotificationTicker } from "./LpNotificationTicker";
import { LpVideo } from "./LpVideo";

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
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b4f34a] text-[#0a0a0b] shadow-[0_0_28px_rgba(180,243,74,.35)]">
      ▶
    </span>
  );
}

const stepImages = [
  ["/prints/p-creators.png", "Tela de criadores acompanhados"],
  ["/prints/p-games.png", "Tela de clipes organizados por jogo"],
  ["/prints/p-editor.png", "Editor de clipes da Alfredd"],
  ["/prints/p-whatsapp.jpeg", "Notificação de novo clipe no WhatsApp"],
] as const;

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#09090a] text-zinc-100">
      <LpNotificationTicker />
      <section className="relative mx-auto max-w-7xl px-5 pb-16 pt-24 sm:px-8 lg:px-10 lg:pb-24 lg:pt-28">
        <div className="lp-orb lp-orb-one" />
        <div className="lp-orb lp-orb-two" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="lp-reveal mb-6 inline-flex items-center gap-2 rounded-full border border-[#b4f34a]/25 bg-[#b4f34a]/10 px-4 py-2 text-[8px] font-semibold uppercase tracking-[0.2em] text-[#b4f34a]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#b4f34a]" />
           O Maior Evento de Todos os Tempos
          </div>

          <h1 className="lp-reveal lp-delay-1 mx-auto max-w-4xl font-serif text-4xl md:text-6xl font-bold leading-[.96] tracking-tighter">
            Cortes infinitos de <span className="text-[#b4f34a]">GTA VI</span> na palma da sua mão.
          </h1>

          <p className="lp-reveal lp-delay-2 mx-auto mt-7 max-w-2xl text-base leading-4 text-zinc-400 sm:text-lg">
            Acompanhe os maiores criadores, encontre os momentos antes de todo mundo e receba clipes prontos para publicar.
          </p>

          <div className="lp-reveal lp-delay-3 mt-9 flex flex-col items-center justify-center gap-3">
            <LandingPageCta />
            <span className="text-xs text-zinc-500">Os primeiros acessos serão liberados no grupo</span>
          </div>
        </div>

        <div className="lp-video-wall relative mx-auto mt-14 grid max-w-4xl grid-cols-3 gap-2 sm:gap-4 lg:mt-20">
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
      </section>

      <section className="border-y border-white/[.06] bg-[#0f0f11] py-20 sm:py-28" id="como-funciona">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-tighter text-[#b4f34a]">Você não precisa procurar sozinho</p>
          <h2 className="mx-auto max-w-3xl text-center text-3xl font-serif font-bold tracking-tighter sm:text-5xl">Enquanto todo mundo assiste, você já está preparando o próximo post.</h2>

          <div className="mt-14 grid gap-4 md:grid-cols-2">
            {steps.map(([number, title, text], index) => {
              const [image, imageAlt] = stepImages[index] ?? stepImages[0];

              return (
                <article key={number} className="lp-step group overflow-hidden p-0">
                  <img src={image} alt={imageAlt} className="h-[250px] w-full object-cover object-center rounded-md shadow-2xl border border-slate-700 opacity-90 transition duration-500 group-hover:opacity-100" />
                  <div className="p-6">
                    <span className="text-sm font-mono text-[#b4f34a]">{number}</span>
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
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-[.25em] text-[#b4f34a]">A fonte não para</p>
        <h2 className="mx-auto max-w-3xl px-5 text-center text-3xl font-bold tracking-tight sm:text-5xl">Todos em um só lugar te mandando conteúdo validado de GTA</h2>
        <p className="mx-auto mt-5 max-w-xl px-5 text-center text-sm leading-6 text-zinc-400">Twitch e YouTube reunidos em uma rotina simples para você nunca ficar sem ideia de corte.</p>
        <div className="mx-auto mt-12 max-w-7xl">
          <FeaturedStreamers hideHeader showClips={false} />
        </div>
      </section>

      <section className="bg-[#b4f34a] px-5 py-20 text-[#0a0a0b] sm:px-8 sm:py-28">
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
        <p className="text-center text-xs font-semibold uppercase tracking-[.25em] text-[#b4f34a]">Perguntas frequentes</p>
        <h2 className="mt-4 text-center text-3xl font-bold tracking-tight sm:text-5xl">Antes de entrar</h2>

        <div className="mt-12 space-y-3">
          {faqs.map(([question, answer]) => (
            <details key={question} className="lp-faq group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                <span>{question}</span>
                <span className="text-xl text-[#b4f34a] transition group-open:rotate-45">+</span>
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
