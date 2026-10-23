# PROMPT MASTER — CLIPES
## SaaS de descoberta, análise e monitoramento de clipes da Twitch

> **Design system:** [ANEXAR AQUI O ARQUIVO/FONTE DO DESIGN SYSTEM APROVADO]. A referência visual enviada pelo proprietário do produto é obrigatória. Não inventar uma identidade substituta. Se o anexo ainda não estiver disponível, implemente arquitetura, lógica e componentes estruturais e mantenha a camada visual preparada para receber os tokens e especificações.

### Sua missão

Você é um engenheiro full-stack sênior e arquiteto de produto. Construa uma **aplicação SaaS funcional e evolutiva**, não um mockup, clone visual estático, landing page isolada ou demo sem backend. O produto se chama provisoriamente **Clipes** e é um radar para quem produz cortes de lives. O usuário encontra clipes relevantes de jogos e streamers, compara seu desempenho, organiza a própria biblioteca e, ao assinar, recebe alertas de novas oportunidades via Telegram e e-mail. A edição do vídeo acontece em ferramentas externas; **não desenvolver editor de vídeo no MVP**.

Trabalhe incrementalmente em código de produção. Priorize a jornada completa e executável em vez de muitas telas sem integrações reais. Documente decisões e lacunas. Não atribua à plataforma capacidades que as APIs não fornecem.

### 1. Stack e convenções obrigatórias

- **Frontend e aplicação web:** Next.js (versão estável compatível no momento da implementação), App Router, TypeScript e React; componentes Server/Client bem separados.
- **Backend principal:** Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions quando apropriado, e agendamento pelo Supabase Cron). Route Handlers/Server Actions do Next.js apenas quando apropriados à fronteira web. Não usar banco adicional.
- **Integração com clipes e categorias:** Twitch Helix API oficial, com OAuth App Access Token gerenciado exclusivamente no servidor.
- **Notificações:** Telegram Bot API e e-mail transacional via Resend.
- **Pagamentos:** arquitetura com interface `BillingProvider`, webhook autenticado e estado de assinatura no Supabase. **Não escolher nem afirmar uma integração de gateway sem definição do proprietário.** Preparar a implementação para plugar um provedor de assinatura mensal posteriormente; nunca marcar assinatura como paga por ação do cliente.
- **CSS:** construir uma aplicação Next.js de verdade. Não entregar HTML estático com um `index.css` solto. Se houver CSS global, usar `app/globals.css` para reset/tokens e estilos isolados por componente (CSS Modules ou abordagem explicitamente exigida pelo design system). Se o design system chegar como um `index.css`, migrar fielmente suas definições para a estrutura correta do Next.js, sem perder tokens ou visual. Não introduzir framework visual conflitante com o anexo.
- **Validação e qualidade:** tipagem estrita, ESLint, validação de entrada, scripts para ambiente local e documentação `.env.example`.
- **Idioma:** interface e textos em português brasileiro; datas formatadas para o fuso do usuário, persistidas em UTC.

### 2. Posicionamento do produto

Proposta: **“Pare de procurar cortes. Descubra os melhores momentos antes que eles viralizem.”**

O valor vendido é **economia de tempo, descoberta, análise, organização e automação**, não propriedade ou revenda dos clipes. O serviço aponta para conteúdos de terceiros respeitando os direitos e condições das plataformas. Não prometer que bom desempenho na Twitch garante viralização em outras redes.

Público inicial: criadores e operadores de canais de cortes de games, especialmente interessados em GTA 6. GTA 6 é exemplo central de UX e comunicação, mas não assumir que a categoria já exista na API nem fixar ID inventado: exibir o que a busca da Twitch realmente retornar.

### 3. A jornada principal, com fricção mínima

1. **Visitante sem conta acessa `/`.** Landing page leve, visualmente excelente e orientada para descoberta imediata. Hero com campo de busca de jogos/streamers, sugestões e alguns exemplos de fontes em destaque validados pela API/cache. Um clique em um card já leva ao feed. **Não exigir cadastro para pesquisar ou explorar.**
2. Busca “GTA 6”, um jogo ou um streamer. Mostra sugestões de categorias e canais; distingue claramente tipo `jogo` de `streamer`. Se não houver resultado, mostrar estado vazio real.
3. Entra no feed público da fonte. Exibir cartões com miniatura, título, streamer, idade do clipe, views, duração e **ClipScore 0–100** ou “Dados insuficientes” quando ainda não calculável.
4. Pode ordenar por recentes, mais vistos, em ascensão e maior ClipScore. Filtros por período, duração, idioma, fonte e score, conforme dados disponíveis.
5. Ao selecionar o clipe, abre detalhe com preview **via embed oficial da Twitch** quando permitido, link oficial e contexto das métricas. Nunca implementar download por extração/scraping de mídia.
6. Ao clicar **Salvar na biblioteca**, pedir cadastro/login apenas se não autenticado; após autenticar, voltar ao mesmo clipe e concluir o salvamento.
7. No plano Free, aplicar cotas. Clipe salvo aparece na biblioteca, com ação para copiar o link oficial, organizar e marcar status: `salvo`, `em edição`, `publicado`.
8. **Aha moment:** encontra um clipe útil, salva e consegue levá-lo para a ferramenta externa de edição com poucos cliques. Exibir convite contextual para explorar mais.
9. Ao atingir cotas ou clicar em `Monitorar`, mostrar benefícios do plano PRO e CTA de assinatura. Recusa do upgrade nunca bloqueia navegação pública.
10. Assinante PRO ativa monitoramento de jogo/streamer, configura gatilho por novo clipe ou ClipScore mínimo, frequência de alertas e canal Telegram/e-mail.
11. Ao surgir oportunidade válida, recebe alerta com link para o clipe no SaaS; volta à plataforma, salva e inicia outro ciclo. Evitar notificações duplicadas, spam e envios sem consentimento.

### 4. Modelo comercial e regras de acesso

**FREE**
- Pesquisa, navegação, visualização de clipes públicos e indicador básico de ClipScore.
- Até **3 jogos favoritos** e **3 streamers favoritos** (atalhos; não são monitoramentos).
- Até **3 clipes salvos por jogo favorito** e até **3 clipes salvos por streamer favorito**. Especificar fonte de salvamento e aplicar regras no backend; um clipe único não pode ser duplicado na biblioteca para burlar a cota. Permitir excluir para liberar espaço.
- Link oficial disponível a partir do clipe/biblioteca, respeitando os controles do conteúdo incorporado. Não vender acesso exclusivo a links públicos.
- **Sem** monitoramentos automáticos e alertas PRO.

**PRO — R$ 37,90/mês (valor proposto, administrável por configuração)**
- Favoritos e biblioteca sem limites comerciais artificiais de itens, com limites técnicos razoáveis contra abuso.
- **Até 20 monitoramentos ativos** simultâneos, somando jogos e streamers.
- Alertas por Telegram e e-mail, com frequência e regras configuráveis.
- Filtros e histórico de desempenho mais avançados, desde que compatíveis com as condições da Twitch.
- Acesso aos recursos PRO apenas enquanto assinatura estiver válida.

Sem sistema de créditos no MVP. Deixar para eventual análise de IA que cause custo variável de processamento. Não criar um segundo ou terceiro plano pago.

**Downgrade/cancelamento:** suspender monitoramentos e alertas sem apagar biblioteca existente; permitir visualização dos dados salvos e limitar novas ações conforme Free. Implementar estado pendente, ativo, vencido e cancelado e conciliação segura pelo servidor.

**Pagamento:** fluxo de interface de assinatura pode ser preparado, mas integração real depende da escolha do PSP. Não criar checkout fictício em produção nem marcar status de pagamento sem webhook verificado. Abstrair `createCheckout`, `handleWebhook`, `getSubscription`, `cancelSubscription`.

### 5. Telas e rotas

- `/` — LP simples com pesquisa e destaques clicáveis; SEO e CTA claros.
- `/explorar` — busca unificada, sugestões, filtros, ranking de categorias/streamers.
- `/jogos/[slug]` — feed de clipes por categoria e botão favoritar/monitorar.
- `/streamers/[login]` — feed de clipes de streamer com botão favoritar/monitorar.
- `/clipes/[id]` — detalhe, ClipScore, métricas, player oficial e salvar.
- `/biblioteca` — itens salvos, coleções básicas, links e status.
- `/favoritos` — jogos e streamers favoritos (atalhos).
- `/monitoramentos` — regras, condições, frequência e limites (PRO).
- `/notificacoes` — canais, consentimento, resumo, pausa e histórico (PRO).
- `/assinatura` — benefícios, status da assinatura e upgrade/downgrade.
- `/entrar` — cadastro/login rápido (Supabase Auth, com retorno à ação iniciada).
- `/configuracoes` — perfil, preferências, privacidade.
- `/admin` — acesso protegido; saúde de integrações, jobs, fontes, limites e falhas. Sem acesso público.

Aplicar o design system anexo com fidelidade: tipografia, escalas, tokens, cores, espaçamentos, bordas, estados de hover/foco, responsividade, acessibilidade e consistência. Exibir loading, erro, vazio, sucesso, limites e paywall. A LP deve colocar o usuário no feed com uma única escolha/click após encontrar a fonte.

### 6. Integração Twitch — comportamento real

Usar os endpoints oficiais:
- `GET /helix/search/categories` para buscar jogos/categorias.
- `GET /helix/search/channels` e/ou `GET /helix/users` conforme necessidade para streamers.
- `GET /helix/games` e `/helix/games/top` quando apropriados.
- `GET /helix/clips?game_id=...` **ou** `?broadcaster_id=...`, com `started_at`, `ended_at`, `first` e paginação.
- Consulta por IDs de clipes para refrescar `view_count`.

Não combinar `game_id` e `broadcaster_id` na mesma consulta (parâmetros mutuamente exclusivos). Para filtro cruzado, aplicar no banco aos dados ingestos. A API de clipes retorna resultados em ordem decrescente de visualizações, **não por data**: reordenar localmente por `created_at` no feed “mais recentes”. Trabalhar com intervalos UTC sobrepostos, paginação, janelas menores para jogos movimentados e deduplicação pelo ID único. Reconhecer a limitação aproximada de paginação por janela; não prometer inventário completo nem latência realmente instantânea. Backoff em erros 429/5xx, observabilidade e cache das categorias.

Não fazer scraping de páginas da Twitch nem de arquivos de mídia. Links e embeds oficiais devem funcionar com domínio `parent` configurado conforme exigências da Twitch. Títulos e thumbnails podem estar ausentes/ruins; tratar gracefully. Não hospedar mídias de terceiros sem autorização.

**Download de clipes:** o endpoint oficial `Get Clips Download` depende de autorização do broadcaster/editor e escopos próprios. Não apresentar download irrestrito para clipes públicos. Exibir opção apenas quando a autorização efetivamente existir; caso contrário oferecer o link original. Não criar rotas clandestinas de extração.

### 7. Engine de monitoramento e ClipScore

Monitoramento **compartilhado**: uma categoria ou streamer é coletada uma vez para servir todos os usuários que a acompanham. Não fazer uma consulta à Twitch para cada assinante. Persistir fontes monitoradas e agendas com prioridade.

Separar: `source discovery`, `clip ingestion`, `view refresh`, `score computation`, `alert matching` e `notification dispatch`. Jobs pequenos, idempotentes, com logs, lock para evitar execução simultânea duplicada, retries e checkpoint de execução. No MVP, avaliar Supabase Cron + Edge Functions para lotes; documentar limites e migração para worker dedicado se volume exigir.

**ClipScore (0–100):** versão inicial explicável e evolutiva, não uma promessa de IA preditiva. Pesos iniciais: velocidade de views por hora 45%; desempenho relativo ao grupo comparável 30%; aceleração 15%; recência 10%. Normalizar métricas por coortes de idade do clipe e jogo/streamer; usar percentis, suavização e limites contra outliers. Guardar snapshots com timestamps para taxa e aceleração. Não criar números sintéticos como se fossem reais. Se faltarem amostras suficientes, marcar `novo` ou `dados insuficientes`; evitar score enganoso.

Guardar histórico e versões da fórmula do score. Exibir “em ascensão” como uma classificação baseada em dados; **não dizer que o clipe vai viralizar**.

### 8. Telegram, e-mail e alertas

- **Telegram:** bot com deep link `t.me/<bot>?start=<token_curto_assinado>`, token de vinculação de curta validade, webhook verificado e confirmação do chat do usuário; permitir desvincular. Não solicitar credenciais do Telegram.
- **E-mail:** Resend, templates responsivos, origem configurável, descadastro/preferências adequados.
- **Regra de alerta:** por novo clipe e/ou score mínimo, com source ID, usuário, duração/intervalo e frequência (`imediato`, `resumo horário`, `resumo diário`). Implementar agrupamento e quiet hours se simples de incluir.
- **Deduplicação:** chave lógica por usuário + regra + clipe + tipo de alerta, registro de tentativa, resultado e erro. Uma mensagem enviada não deve ser disparada duas vezes por concorrência/retry.
- NUNCA enviar alertas não consentidos, nem usar dados de espectadores da Twitch para marketing direcionado.

### 9. Dados e segurança Supabase

Definir e entregar migrations SQL versionadas, índices, constraints, políticas RLS e seeds mínimos **somente com dados demonstrativos identificados**. Sugestão de entidades:

- `profiles` — referência a `auth.users`, preferências.
- `games` e `streamers` — catálogo em cache com IDs oficiais externos.
- `clips` — ID da Twitch único, URL/embed, metadados, IDs das fontes, `created_at` da Twitch, views recentes, sincronização.
- `clip_view_snapshots` — views observadas e instante de observação.
- `clip_scores` — valor, versão do cálculo, fatores e instante.
- `favorites` — favorito de jogo ou streamer por usuário.
- `library_items` — associação única usuário–clipe, fonte de salvamento, status, timestamps.
- `monitorings` — usuário, tipo de fonte, fonte, regras, frequência, ativo/pausado.
- `notification_channels` e `notification_deliveries` — vinculação consentida, status e dedupe.
- `subscriptions` e `billing_events` — plano, validade, gateway IDs e logs de webhook idempotentes.
- `source_jobs`/`job_runs` — checkpoint, status e execução do coletor.

Propor tipos TypeScript gerados do banco. Criar constraints de unicidade, índices nas consultas de feed e favoritas e proteção contra corrida de requisições nas cotas Free e PRO (**cotas verificadas atomicamente no backend, não apenas no frontend**). RLS para dados pessoais, biblioteca, monitoramento, notificações e assinatura; dados públicos somente com permissões explícitas. Service role e segredos **nunca** expostos ao navegador. Sanitizar entrada, proteger endpoints de workers, aplicar rate limiting e cuidar de privacidade, LGPD e retenção de logs.

### 10. Regras comerciais e de plataforma que precisam de validação

- Não monetizar diretamente a reprodução de embeds ou a venda de URLs/metadados da Twitch. O PRO deve ser apresentado como serviço de produtividade. **Antes de ativar monetização de analytics derivados de dados Twitch e afiliados direcionados, exigir revisão dos termos atuais e autorização quando aplicável.** Não declarar conformidade jurídica automaticamente.
- Respeitar branding, embeds, integridade do player e controles da Twitch.
- Proteger identificação dos usuários e segredos de integração.
- O recurso futuro de **afiliados de plataformas de edição automática** deve entrar em backlog, com integração desacoplada e validação jurídica/comercial: não construir um marketplace baseado em dados da Twitch sem verificar autorização exigida.

Fontes oficiais para consulta durante implementação:
- https://dev.twitch.tv/docs/api/reference
- https://dev.twitch.tv/docs/api/clips/
- https://legal.twitch.com/en/legal/developer-agreement/
- https://supabase.com/docs/guides/auth/server-side
- https://supabase.com/docs/guides/functions/schedule-functions
- https://core.telegram.org/bots/features
- https://resend.com/docs

### 11. Arquitetura do código

Adotar estrutura por domínios e componentes reutilizáveis, por exemplo:

```
src/
  app/                      # Rotas públicas, autenticadas e endpoints web
  components/               # UI e elementos de domínio
  features/
    discovery/
    clips/
    library/
    favorites/
    monitoring/
    notifications/
    billing/
    auth/
  lib/
    supabase/
    twitch/
    telegram/
    resend/
    permissions/
    scoring/
  styles/                   # Tokens adicionais, caso solicitados pelo DS
supabase/
  migrations/
  functions/                # Ingestão, refresh, alertas e webhooks se aplicável
  seed.sql
scripts/
tests/
README.md
.env.example
```

Não acoplar chamadas Twitch diretamente aos componentes client-side. Tornar cálculo do score uma função pura, testável. Separar persistência, regras de negócio e apresentação. Evitar dependências redundantes.

### 12. Ordem de entrega

**Fase 0 — Fundação:** analisar o design system anexo, mapear componentes/tokens, configurar Next.js, TypeScript, Supabase, Auth, SQL/RLS, layouts, variáveis de ambiente e seed/estados vazios. Verificar build e dev server.

**Fase 1 — Primeira experiência e aha moment:** LP pesquisável sem login, API Twitch de categorias e canais, feed real, clipe/detalhe, cadastro só ao salvar, favoritos, biblioteca Free e limites aplicados no servidor. Deve ser possível reproduzir o ciclo: entrar → pesquisar → achar clipe → cadastrar → salvar → copiar URL.

**Fase 2 — Radar:** ingestão compartilhada e histórica, snapshots, ClipScore, ordenações e filtros, painel básico de saúde de sincronização.

**Fase 3 — PRO e notificações:** paywall contextual, modelo de assinatura com gateway pluggable (integração real apenas após escolha), monitoramento com limite, Telegram e Resend, filas, deduplicação, pausas e preferências.

**Fase 4 — Endurecimento:** testes automatizados, falhas/retries, RLS adversarial, métricas de conversão e retenção, estados de erro, SEO, acessibilidade, mobile, performance e manual de deploy.

**Futuro (NÃO implementar agora):** editor de vídeo interno, download não autorizado, workflow canvas avançado, sistema de créditos, integrações automáticas com editores e afiliados, YouTube Clips comunitários como se houvesse API equivalente.

### 13. Critérios de aceite

- Um visitante consegue buscar uma categoria/streamer e visualizar clipes reais sem login.
- Clicar em `Salvar` pede autenticação e retoma a intenção sem perder contexto.
- Free não passa de 3 jogos, 3 streamers e 3 clipes salvos por fonte; tentativas de burlar cotas por API ou concorrência falham.
- A biblioteca mostra itens persistidos e links oficiais; não há download de terceiro sem autorização.
- O banco não duplica clipes coletados; monitoramento é compartilhado; cron/jobs e falhas são observáveis.
- O ClipScore não é inventado e fica indisponível quando faltam snapshots.
- PRO consegue configurar até 20 monitoramentos ativos; regras geram no máximo uma notificação por evento, com consentimento e opção de pausa.
- RLS impede acesso de outro usuário a favoritos, biblioteca, notificações e assinatura.
- Conteúdo funciona em desktop e mobile; UI respeita integralmente o design system anexado.
- Build, lint e testes passam; projeto tem README com comandos de setup, variáveis e deploy.

### 14. Modo de trabalho

Antes de codificar, produza um **plano de execução curto**, mapeie dúvidas realmente bloqueantes e escolha defaults razoáveis para decisões reversíveis. Não faça perguntas já respondidas neste briefing. Entregue mudanças por fases com código real, migrations e testes; em cada fase informe arquivos criados, funcionamento, limitações e próximos passos. Se chaves da Twitch/Supabase/Telegram/Resend ou gateway estiverem ausentes, implemente integrações com interfaces, validação de ambiente e mensagens claras; mocks apenas isolados em desenvolvimento/testes e jamais apresentados como dados reais em produção.

**Prioridade absoluta:** construir primeiro o caminho de valor completo com fricção mínima. A landing page é uma porta para o produto, não seu destino final.
