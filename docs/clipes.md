# Clipes — Roadmap, decisões e limitações

## Fases de entrega

- **Fase 0 — Fundação (atual).** Scaffolding Next.js + TS, design system
  (tokens + componentes), AppShell com todas as rotas e estados vazios,
  migrations SQL + RLS + seed demonstrativo, libs de integração preparadas
  (Twitch, Supabase, scoring, permissions, billing, telegram, resend),
  validação de ambiente e `/admin` com status de integrações.
- **Fase 1 — Primeira experiência / aha moment (atual).** Supabase Auth
  (e-mail+senha), busca real na Twitch (categorias/canais), feed real por
  jogo/streamer com ordenação, detalhe do clipe com embed oficial, cadastro só
  ao salvar (com retomada via `?save=1`), favoritos e biblioteca Free com cotas
  aplicadas atomicamente no backend (RPCs com advisory lock — migration 0003).
- **Fase 2 — Radar.** Ingestão compartilhada e histórica, snapshots, ClipScore,
  ordenações/filtros, painel de saúde de sincronização.
- **Fase 3 — PRO e notificações.** Paywall contextual, assinatura via AbacatePay
  (webhook verificado), monitoramento com limite, Telegram + Resend, filas,
  deduplicação, pausas e preferências.
- **Fase 4 — Endurecimento.** Testes, retries, RLS adversarial, métricas, SEO,
  acessibilidade, performance e manual de deploy.

## Decisões tomadas nesta fase

- **App na raiz** do repositório, convivendo com `agent_hub/` (Python).
- **CSS Modules + tokens** em `globals.css` (sem Tailwind), para fidelidade ao
  design system escuro das referências em `ai/design-system-examples/`.
- **Gateway de pagamento: AbacatePay**, já indicado pelo proprietário via
  `.env` (`ABACATEPAY_DEV_KEY`, `ABACATEPAY_WEBHOOK`). Implementado atrás da
  interface `BillingProvider`; integração real só na Fase 3.
- **Twitch via App Access Token** (client credentials) — não exige URL pública
  nem login do usuário com a Twitch no MVP.

## Limitações conhecidas (Fase 0)

- Nenhuma chamada real à Twitch ainda é disparada pela UI (libs prontas e
  inertes). O feed é um estado vazio informativo.
- `database.types.ts` é um placeholder até `npm run db:types` rodar contra o
  projeto Supabase com as migrations aplicadas.
- Autenticação, cotas e salvamento são apresentados como estados vazios; a
  lógica entra na Fase 1.

## Regras que exigem validação do proprietário (guia §10)

- Monetização de analytics derivados de dados da Twitch e afiliados exigem
  revisão dos termos vigentes antes de ativar.
- Download de clipes só quando houver autorização efetiva do broadcaster; caso
  contrário, apenas link/embed oficial.
