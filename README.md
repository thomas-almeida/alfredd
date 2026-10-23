# Clipes

**SaaS de descoberta, análise e monitoramento de clipes da Twitch.**
_"Pare de procurar cortes. Descubra os melhores momentos antes que viralizem."_

Radar para quem produz cortes de lives: encontre clipes relevantes de jogos e
streamers, compare desempenho com o **ClipScore**, organize sua biblioteca e,
no plano PRO, receba alertas de novas oportunidades via Telegram e e-mail.

> Status: **Fase 0 — Fundação**. Veja [docs/clipes.md](docs/clipes.md) para o
> roadmap por fases, decisões e limitações.

## Stack

- **Next.js** (App Router) + **TypeScript** estrito + **React** — CSS Modules + tokens.
- **Supabase** (Postgres, Auth, RLS) — migrations versionadas em `supabase/`.
- **Twitch Helix API** — App Access Token gerenciado no servidor.
- **Telegram Bot API** + **Resend** (e-mail) — notificações (Fase 3).
- **AbacatePay** — pagamentos via abstração `BillingProvider` (Fase 3).

## Setup

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie as variáveis de ambiente e preencha:
   ```bash
   cp .env.example .env
   ```
   Mínimo para subir o dev server: `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Para feed real da Twitch:
   `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET`. Para operações server-side:
   `SUPABASE_SERVICE_ROLE_KEY`.
3. Rode o ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```

## Banco de dados

As migrations ficam em `supabase/migrations/` e o seed demonstrativo em
`supabase/seed.sql`. Aplicando com a Supabase CLI:

```bash
supabase db reset          # aplica migrations + seed no projeto local
npm run db:types           # gera src/lib/supabase/database.types.ts
```

## Scripts

| Script             | Descrição                                  |
| ------------------ | ------------------------------------------ |
| `npm run dev`      | Servidor de desenvolvimento                |
| `npm run build`    | Build de produção                          |
| `npm run start`    | Servir build de produção                   |
| `npm run lint`     | ESLint (next lint)                         |
| `npm run typecheck`| Checagem de tipos (tsc --noEmit)           |
| `npm run test`     | Testes unitários (node:test)               |

## Estrutura

```
src/
  app/            # Rotas (públicas, autenticadas, admin)
  components/     # UI (ui/) e layout (layout/)
  features/       # Domínios (discovery/, …)
  lib/            # supabase/ twitch/ scoring/ permissions/ billing/ telegram/ resend/ env
supabase/
  migrations/     # 0001_init.sql, 0002_rls.sql
  seed.sql
tests/            # Testes (ClipScore)
```

## Deploy

Aplicação Next.js — alvo recomendado: Vercel. Variáveis de ambiente devem ser
configuradas no provedor; os segredos (`*_SECRET`, `SERVICE_ROLE_KEY`) nunca são
expostos ao browser. Migrations aplicadas via Supabase CLI/CI antes do deploy.

---

## Agent Hub (Python)

Este repositório também inclui o **Agent Hub**, um orquestrador local em Python
para delegar tarefas a agentes. Consulte [docs/agent-hub.md](docs/agent-hub.md).
