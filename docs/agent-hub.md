# Agent Hub

O Agent Hub é um coordenador local para vários agentes de código. Ele não tenta ser um modelo: mantém tarefas e eventos, e executa agentes externos através de um adaptador de comando.

## Rodar

Requer Python 3.11+ e não requer dependências externas:

```powershell
python -m agent_hub serve
python -m agent_hub worker --id claude-backend --roles backend,reviewer
python -m agent_hub worker --id claude-frontend --roles frontend,ui
```

Em outro terminal, crie uma tarefa:

```powershell
python -m agent_hub task "Mapear o domínio" "Defina entidades e riscos do MVP" --role architect
```

Ou via API:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/tasks -Method Post -ContentType 'application/json' -Body (@{
  title='Criar migration inicial'; description='Modelar tabelas e RLS'; role='backend'
} | ConvertTo-Json)
```

`GET /tasks` mostra o quadro atual. `GET /events` é um stream SSE para UI, bots e outros agentes receberem atualizações ao vivo. Dependências são informadas por `depends_on` com IDs de tarefas; uma tarefa só é liberada quando todas terminam com `done`.

## Conectar Claude Code

Defina `AGENT_HUB_COMMAND` antes de iniciar os workers. O worker injeta o prompt em `AGENT_TASK_PROMPT`; o comando deve operar no repositório e retornar código de saída zero quando entregar a tarefa. Exemplo no PowerShell:

```powershell
$env:AGENT_HUB_COMMAND = 'claude -p "%AGENT_TASK_PROMPT%"'
python -m agent_hub worker --id claude-1 --roles architect,backend,frontend,reviewer
```

Para ferramentas com contrato próprio, crie um adapter implementando `Adapter.run`. O núcleo não envia segredos para agentes e não executa automaticamente `--dangerously-skip-permissions`; essa decisão fica explícita no comando configurado pelo operador.

## Limites atuais

- A persistência é SQLite local; para equipe distribuída, trocar `Store` por Postgres/Supabase.
- SSE é suficiente para acompanhamento local, mas não substitui autenticação, autorização e fila durável de produção.
- O papel de planejamento ainda é explícito: o agente coordenador ou usuário cria as tarefas. A próxima evolução pode adicionar decomposição por LLM com aprovação humana.
- O processo do agente tem timeout de uma hora e captura stdout/stderr como entrega.
