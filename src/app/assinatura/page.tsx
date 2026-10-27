import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

export const metadata = { title: "Assinatura" };

const free = [
  "Pesquisa e navegação sem login",
  "Busca e organização de clipes",
  "Favoritos ilimitados de jogos e criadores",
  "5 clipes salvos no total",
];
const pro = [
  "Biblioteca sem limites artificiais",
  "Até 20 monitoramentos ativos",
  "Alertas por Telegram e e-mail",
  "Filtros e histórico avançados",
];

const highlights = [
  { icon: "radar", title: "Monitoramento contínuo", text: "Acompanhe até 20 jogos e streamers e veja os clipes que estão subindo." },
  { icon: "bell", title: "Alertas na hora", text: "Receba no Telegram ou por e-mail quando surgir um clipe com potencial." },
  { icon: "bookmark", title: "Biblioteca sem teto", text: "Salve quantos clipes quiser e organize tudo em um só lugar." },
  { icon: "clock", title: "Histórico avançado", text: "Filtre por período, idioma e desempenho para achar o momento certo." },
] as const;

const compare: [string, string | boolean, string | boolean][] = [
  ["Busca de jogos e streamers", true, true],
  ["Jogos favoritos", "Ilimitado", "Ilimitado"],
  ["Criadores favoritos", "Ilimitado", "Ilimitado"],
  ["Clipes salvos", "5", "Ilimitado"],
  ["Monitoramentos ativos", false, "20"],
  ["Alertas por Telegram e e-mail", false, true],
  ["Filtros e histórico avançados", false, true],
];

function Check({ muted }: { muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-[18px] h-[18px] rounded-full shrink-0",
        muted ? "bg-surface-2 text-muted" : "bg-accent text-accent-fg",
      )}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  );
}

function FeatureList({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="list-none p-0 flex flex-col gap-3 text-[13px]">
      {items.map((f) => (
        <li key={f} className={cn("flex items-start gap-2.5", muted ? "text-muted" : "text-fg")}>
          <Check muted={muted} />
          {f}
        </li>
      ))}
    </ul>
  );
}

function Cell({ v, pro }: { v: string | boolean; pro?: boolean }) {
  if (v === true) return <Check muted={!pro} />;
  if (v === false) return <span className="text-subtle">—</span>;
  return <span className={pro ? "font-semibold text-accent" : "text-muted"}>{v}</span>;
}

export default function AssinaturaPage() {
  return (
    <AppShell crumbs={[{ label: "Assinatura" }]}>
      <section className="text-center max-w-[640px] mx-auto pt-4 pb-10">
        <Badge tone="accent">Planos</Badge>
        <h1 className="mt-4 text-4xl max-[640px]:text-3xl font-bold tracking-tight">
          Encontre o clipe certo <span className="text-accent">antes de todo mundo</span>
        </h1>
        <p className="text-muted mt-3">
          O PRO é um serviço de produtividade: economia de tempo, descoberta, análise,
          organização e automação.
        </p>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5 max-w-[820px] mx-auto items-stretch">
        <div className="flex flex-col p-6 border border-border rounded-lg bg-surface">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Free</h3>
            <Badge>Seu plano</Badge>
          </div>
          <p className="text-[13px] text-subtle mt-1">Para conhecer a plataforma.</p>
          <div className="text-4xl font-bold mt-5">R$ 0</div>
          <div className="text-xs text-subtle mt-1">para sempre</div>
          <div className="my-6 h-px bg-border" />
          <FeatureList items={free} muted />
          <div className="mt-auto pt-6">
            <Button className="w-full" disabled>Plano atual</Button>
          </div>
        </div>

        <div className="relative flex flex-col p-6 rounded-lg border border-accent bg-[linear-gradient(160deg,color-mix(in_oklab,var(--color-accent)_14%,var(--color-surface))_0%,var(--color-surface)_55%)] shadow-[0_0_0_1px_var(--color-accent),0_20px_60px_-20px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-accent text-accent-fg text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">
            Mais escolhido
          </span>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              PRO <Icon name="star" width={16} height={16} className="text-accent" />
            </h3>
            <Badge tone="accent">Recomendado</Badge>
          </div>
          <p className="text-[13px] text-muted mt-1">Para quem vive de clipes.</p>
          <div className="mt-5 flex items-baseline gap-1">
            <span className="text-4xl font-bold">R$ 37,90</span>
            <span className="text-muted">/mês</span>
          </div>
          <div className="text-xs text-subtle mt-1">cancele quando quiser</div>
          <div className="my-6 h-px bg-accent/30" />
          <p className="text-xs uppercase tracking-wider text-subtle mb-3">Tudo do Free, mais:</p>
          <FeatureList items={pro} />
          <div className="mt-auto pt-6">
            <Button variant="primary" className="w-full" disabled>
              Assinar PRO (em breve)
            </Button>
            <p className="mt-3 text-xs text-subtle text-center">
              Checkout via AbacatePay chegando em breve.
            </p>
          </div>
        </div>
      </div>

      <section className="max-w-[1000px] mx-auto mt-16">
        <h2 className="text-xl font-bold text-center">O que o PRO destrava</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4 mt-6">
          {highlights.map((h) => (
            <div key={h.title} className="p-5 border border-border rounded-lg bg-surface hover:border-accent/50 transition-colors">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-accent/15 text-accent">
                <Icon name={h.icon} />
              </span>
              <h3 className="mt-3 text-[0.9375rem] font-semibold">{h.title}</h3>
              <p className="mt-1 text-[13px] text-muted">{h.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[820px] mx-auto mt-16 mb-8">
        <h2 className="text-xl font-bold text-center">Compare os planos</h2>
        <div className="mt-6 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface">
                <th className="text-left font-semibold p-3">Recurso</th>
                <th className="w-[110px] p-3 font-semibold text-muted">Free</th>
                <th className="w-[110px] p-3 font-semibold text-accent bg-accent/10">PRO</th>
              </tr>
            </thead>
            <tbody>
              {compare.map(([label, f, p]) => (
                <tr key={label} className="border-t border-border">
                  <td className="p-3">{label}</td>
                  <td className="p-3 text-center"><span className="inline-flex justify-center"><Cell v={f} /></span></td>
                  <td className="p-3 text-center bg-accent/5"><span className="inline-flex justify-center"><Cell v={p} pro /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
