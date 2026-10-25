# Alfred Media Worker

Serviço independente para executar operações que precisam de `ffmpeg` e `yt-dlp`.

## Deploy no Render

Crie um **Web Service** apontando para este mesmo repositório e use:

- Root Directory: `media-worker`
- Environment: `Docker`
- Dockerfile: `Dockerfile`
- Health Check Path: `/health`

Variáveis obrigatórias:

```env
MEDIA_WORKER_SECRET=uma-chave-forte
```

Variáveis opcionais:

```env
PORT=8080
YOUTUBE_MEDIA_MAX_HEIGHT=480
MAX_VOD_WINDOW_SECONDS=10800
MEDIA_CACHE_TTL_MS=1800000
TWITCH_WEB_CLIENT_ID=
```

O cache local é temporário. Arquivos permanentes devem ser salvos no Supabase Storage pela aplicação principal.

## Integração com a Vercel

Na Vercel, configure:

```env
MEDIA_WORKER_URL=https://seu-worker.onrender.com
MEDIA_WORKER_SECRET=mesmo-valor-do-render
```

As rotas `/api/youtube/source` e `/api/twitch/download` encaminham YouTube e VODs da Twitch para o worker quando `MEDIA_WORKER_URL` estiver definida. Sem essa variável, o comportamento local existente continua sendo usado.
