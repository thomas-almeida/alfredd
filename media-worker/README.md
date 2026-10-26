# Alfred Media Worker

Worker independente para operacoes que dependem de `yt-dlp`, FFmpeg, Deno e do provider de PO Token.

## Arquitetura que esta funcionando

```text
Vercel / Next.js
  ├─ autentica usuario, controla cota e cache da transcricao
  ├─ /api/youtube/source ──> Fly /youtube/source
  └─ /api/transcript ─────> Fly /youtube/transcript (fallback Whisper)

Fly / media-worker
  ├─ yt-dlp + cookies + proxy + user-agent + PO Token
  ├─ FFmpeg local para preparar o audio
  ├─ Groq Whisper para gerar palavras com timestamps
  └─ MP4 progressivo assinado para o player do navegador
```

O worker Fly atual e `https://alfredd-media-worker.fly.dev`.

## Rotas

### `GET /health`

Publica. Usada pelo Fly para verificar se o processo esta vivo.

### `GET /youtube/source`

Protegida por `Authorization: Bearer MEDIA_WORKER_SECRET`.

- O editor usa `audio=0` para pedir um MP4 progressivo.
- O worker baixa o MP4 com `yt-dlp`, armazena no cache temporario e o serve com suporte a `Range`.
- O navegador nao acessa diretamente URLs assinadas do YouTube.
- Nao alterar o editor para usar o fluxo FFmpeg de video+audio sem um teste real de reproducao.

### `POST /youtube/transcript`

Protegida pelo mesmo secret. Recebe `videoId` e opcionalmente `vocabulary`.

O fluxo obrigatorio e:

1. `yt-dlp` baixa o audio para um arquivo local usando proxy, cookies, user-agent e PO Token.
2. FFmpeg converte o arquivo local em partes MP3 mono/16 kHz.
3. Cada parte e enviada ao Groq Whisper.
4. O worker devolve palavras, linhas, blocos e timestamps.

O FFmpeg nao deve receber `-http_proxy` nesse fluxo: ele trabalha sobre arquivo local. O proxy e aplicado pelo `yt-dlp` durante o download.

## Variaveis do Fly

Obrigatorias:

```env
MEDIA_WORKER_SECRET=
YOUTUBE_PROXY_URL=
YOUTUBE_COOKIES_B64=
YOUTUBE_USER_AGENT=
GROQ_API_KEY=
```

Ja configuradas no app Fly:

```env
YTDLP_TIMEOUT_MS=60000
YOUTUBE_POT_PROVIDER_URL=http://127.0.0.1:4416
```

O provider de PO Token e iniciado pelo `start.sh` na porta interna `4416`. A porta publica do worker continua sendo `8080`.

## Variaveis da Vercel

```env
MEDIA_WORKER_URL=https://alfredd-media-worker.fly.dev
MEDIA_WORKER_SECRET=mesmo-valor-do-Fly
```

Proxy, cookies, user-agent e `GROQ_API_KEY` devem ficar somente no Fly. O `.env` local nao altera automaticamente as variaveis da Vercel.

## Regras de compatibilidade

- Manter apenas uma maquina Fly para este worker: o progresso e caches sao armazenados em memoria.
- Manter pelo menos 2 GB de memoria; o Deno usado pelo yt-dlp ja causou OOM com 1 GB.
- Manter `PORT=8080` e o bind em `0.0.0.0`.
- Nao remover Deno, `yt-dlp[default]`, `bgutil-ytdlp-pot-provider` ou FFmpeg do Dockerfile.
- Nao imprimir tokens PO, cookies, URLs assinadas, proxy ou chaves nos logs.
- Nao fazer o FFmpeg da Vercel processar YouTube; a Vercel nao possui FFmpeg instalado.
- Mudancas no fluxo YouTube exigem `npm.cmd test -- --runInBand`, `npm.cmd run typecheck` e teste real de preview/transcricao.

## Testes de regressao

`tests/mediaWorker.test.js` cobre:

- health check e autenticacao das rotas;
- protecao da rota de transcricao;
- deduplicacao da resolucao do MP4;
- download local antes do FFmpeg;
- ausencia de `-http_proxy` no FFmpeg da transcricao;
- sanitizacao de erros 403 e URLs assinadas;
- memoria de 2048 MB no `fly.toml`;
- uso de MP4 progressivo no editor.

Comandos:

```powershell
npm.cmd test -- --runInBand
npm.cmd run typecheck
```

## Deploy

Execute a partir de `media-worker`:

```powershell
fly deploy --config .\fly.toml --dockerfile .\Dockerfile
```

Depois confirme:

```powershell
fly status --app alfredd-media-worker
Invoke-WebRequest https://alfredd-media-worker.fly.dev/health
```

O deploy da Vercel ocorre pelo push para `main`. Depois do deploy, teste video, transcricao e selecao de trecho no editor.
