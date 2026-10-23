# Clipador (editor de clipes 9:16)

Transforma um clipe da Twitch em um short vertical MP4 de 1080×1920 (no máximo 90 s), sem servidor de render.

> **Importante:** só baixe e processe clipes quando houver autorização efetiva do broadcaster.

## Fluxo

1. Clique em **Cortar** (na página do clipe ou na biblioteca) para abrir `/clipes/[id]/editor`.
2. `POST /api/clips/[id]/ingest` só registra o clipe em `clips` (respeitando o limite do plano). O vídeo **não** é copiado: o editor e o export leem o MP4 da Twitch por `GET /api/clips/[id]/source`, um proxy em streaming na mesma origem (com suporte a Range), porque a CDN da Twitch não envia headers CORS.
3. No editor:
   - preview 9:16;
   - trim (até 90 s);
   - crop por slot;
   - layouts `full` e `cam_game`.

   O estado fica salvo em `clip_projects` (autosave de 1 s) e o status passa para `em_edicao`.
4. **Exportar** gera o MP4 no navegador, com Mediabunny + WebCodecs num Web Worker (`src/lib/export/export.worker.ts`). O arquivo vai para `shorts/{userId}/{renderId}.mp4`, ganha uma linha em `renders` e o status muda para `exportado`.
5. O status é atualizado via Supabase Realtime (`ClipStatusBadge`).
6. **Próximo clip →** abre o próximo clipe ainda não editado.

## Arquivos principais

- `supabase/migrations/0004_*`: tabelas, RLS, buckets e a RPC `set_clip_status`.
- `src/lib/export/layouts.ts`: geometria pura, coberta por `tests/layouts.test.ts`.
- `src/lib/twitch/clip-slug.ts`: parsing e escolha de qualidade, coberto por `tests/clipSlug.test.ts`.
- `src/features/editor/`: `ClipEditor`, `ExportPanel`, `ClipStatusBadge` e `actions.ts`.

## Requisitos

O export exige um navegador com WebCodecs (Chrome, Edge ou Safari recentes). Nos outros navegadores, o painel mostra um aviso.
