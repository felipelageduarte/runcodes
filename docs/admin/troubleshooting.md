---
title: Troubleshooting
sidebar_position: 8
---

# Troubleshooting

Diagnóstico dos problemas recorrentes de operação, do sintoma à causa. Mantenha aberto junto: [Pipeline](./operacao/pipeline.md) e [Contratos](./architecture/contratos.md).

## Submissões presas em "na fila" (IN_QUEUE)

O sintoma operacional mais comum. Checagem em ordem:

1. **O engine está rodando?** `docker ps` no host do compiler (ou o equivalente do deploy). Sem processo, nada sai da fila.
2. **O engine alcança o banco?** Logs do engine: erro de conexão/pool do Postgres aparece imediatamente no startup e a cada ciclo de poll.
3. **O engine alcança o Docker?** Precisa de `/var/run/docker.sock` montado. Erro típico nos logs: permissão/`FileNotFoundError` do socket.
4. **A imagem da linguagem existe no host?** Primeiro commit de uma linguagem nova força um pull de `ghcr.io/runcodes-icmc/runcodes-compiler-images-<lang>` — sem rede ou sem a imagem publicada, o pipeline falha.
5. **Fila saturada?** Se há processamento mas lento, veja a concorrência (`RUNCODES_COMPILER_CONCURRENCY`) vs. recursos do host. O engine escala horizontalmente: instâncias extras apontando pro mesmo banco dividem a fila com claim atômico.

Um commit individual preso com todos os demais fluindo normalmente: olhe a linha no banco — se está `PROCESSING` há muito tempo, a instância que o reivindicou pode ter morrido no meio; recompilar o commit o reenfileira.

## Commits terminando em SERVER_ERROR (erro interno)

1. Logs do engine na janela de tempo do commit — a exceção da fase que falhou está lá com o id.
2. Com `cleanup_on_error` desligado, o diretório `exec_dir/commit_<id>` fica preservado no host: contém o fonte baixado, o `container.config`, saídas parciais e os `*.monitor_out` — material completo de autópsia.
3. Causas frequentes:
   - **Objeto S3 ausente** — a linha de `commits` aponta um `aws_key` que não resolve no bucket (upload falhou pela metade, bucket errado, prefixo trocado). Confira `RUNCODES_S3_*` dos dois lados ([contratos](./architecture/contratos.md#as-chaves-s3-que-não-podem-mudar)).
   - **Protocolo de mensagens quebrado** — depois de mudanças em `runcodes-compiler-images`: se o script da imagem não imprime `compilation.start/done`, `run.start/done` exatos e na ordem, o engine trava até estourar o timeout. Teste a imagem nova com um commit de fumaça antes de publicar.
   - **Disco cheio** no `exec_dir` ou no host Docker (camadas de imagem + diretórios de trabalho preservados por erro acumulam).
4. Resolvida a causa, **recompile** os commits afetados — a reavaliação é idempotente.

## Resultado estranho de correção (todo mundo errando um caso)

- **Gabarito com espaço/quebra de linha sobrando** — baixe o caso (`{caseId}/in` e `{caseId}/out` no bucket `-cases`) e inspecione byte a byte.
- **Casos alterados sem recompilar** — a matriz mostra "submissões desatualizadas"; recompile o exercício.
- **Limite de tempo apertado** — o `monitor_out` de cada caso registra tempo e sinal; SIGKILL generalizado num caso indica limite irreal pra carga.
- **Arquivo de compilação ausente** — exercícios ghost resolvem `compilation_files` pelo `real_id`; se o original foi apagado/alterado, as cópias sentem junto.

## Emails não chegam (confirmação, reset, broadcast)

1. Config SMTP da API (`SMTP_HOST`/`PORT`/`SECURE`/`USER`/`PASSWORD`/`FROM`).
2. Em dev, tudo vai pro **smtp4dev** (`localhost:8081`) — se o email "não chegou", olhe lá primeiro.
3. Tabela `mail_logs` registra tentativas; broadcast é best-effort por destinatário (um endereço inválido não cancela o lote).
4. Tokens expiram: confirmação em 24h, reset em 1h — "link inválido" depois disso é comportamento correto; o reenvio gera token novo.

## Usuário não consegue logar

- **"Conta não confirmada"** — o aviso só aparece com a senha certa (anti-enumeração). Reenviar confirmação resolve.
- **Login funcionava no sistema legado e parou** — esperado após o primeiro login bem-sucedido pela API nova: o hash migra de sha1 pra bcrypt e o PHP legado deixa de validar aquele usuário ([caminho sem volta](./backend/auth.md#migração-de-senha-sha1--bcrypt), deliberado).
- **Código de turma com "universidade diferente"** — conta cadastrada em outra instituição; corrigir a universidade do usuário (admin) ou o próprio usuário no perfil.

## Storage (SeaweedFS/S3)

- Buckets esperados: `{prefix}-commits`, `-cases`, `-files`, `-outputfiles` (prefixo `RUNCODES_S3_BUCKET_PREFIX`, default `runcodes`).
- Teste de sanidade com as credenciais da API/engine: `GetObject` numa chave conhecida de cada bucket.
- O `server` legado notifica inconsistência commit↔S3 no Slack (`Log::slackNotification`) — essas notificações indicam upload órfão ou objeto removido.

## Worker de plágio

- Execuções presas em `queued`: o worker (`npm run start:worker`) é um processo separado da API — confira se está rodando e se alcança o **Redis** (fila BullMQ).
- `failed` com JPlag: exige **JVM no host do worker**; exercícios muito curtos abortavam com o default de tokens mínimos — o sistema já roda com `-t 1`, mas versões novas do jar podem reintroduzir o comportamento.
- Turmas grandes: a comparação é O(n²) — minutos, não segundos. Não é travamento.

## Quando o problema é novo

1. Reproduza no `local-dev` (sobe o stack inteiro, incluindo engine real).
2. Rode os testes de integração do `runcodes-api` — eles exercitam os contratos reais com engine, S3 e SMTP e denunciam quebra de contrato rápido ([testing](./backend/testing.md)).
3. Registre o achado: gap de produto vai pro [roadmap](./roadmap/backlog.md); comportamento de contrato vai pra [Contratos](./architecture/contratos.md).
