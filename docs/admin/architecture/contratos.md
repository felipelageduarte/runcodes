---
title: Contratos entre módulos
sidebar_position: 1.8
---

# Contratos entre módulos

O sistema não tem RPC entre os módulos — a integração acontece por **banco compartilhado**, **storage S3 compartilhado** e um **protocolo de mensagens em stdout**. Isso torna a migração incremental possível, mas significa que vários contratos implícitos quebram silenciosamente se mudados de um lado só. A tabela de referência:

| Se você mudar... | Precisa revisar também... | Por quê |
|---|---|---|
| Schema de `commits`, `exercise_cases`, `commits_exercise_cases` (`database/`) | `server/.../Model/Commit.php`, `Exercise*.php`; `runcodes-api` (schema Prisma); `runcodes-compiler/.../model/commit.py`, `test_case.py`, `provider/data/postgres.py` | Mesmo schema, leitores/escritores em PHP (ORM), TypeScript (Prisma) e Python (SQL raw) |
| Mensagens de protocolo `compilation.start/done`, `run.start/done` (`runcodes-compiler-images/*/*-script.sh`) | `runcodes-compiler/src/rcc/engine/container.py` (`expect_message`) | O engine trava/estoura timeout se a mensagem não vier exatamente nesse texto e nessa ordem |
| Formato do arquivo `*.monitor_out` (`runcodes-compiler-sandbox/src/monitor.c`) | `runcodes-compiler/src/rcc/engine/grading.py` (parseia `[info] time=/signal=`) | O parser assume chaves específicas na seção `[info]` |
| Nomes/prefixo dos buckets S3, `RUNCODES_S3_*` | `server/.../Model/Archive.php`, `runcodes-api` (StorageRepository), `deploy/roles/data-seaweed` | Todos batem no mesmo storage S3-compatível |
| `RUNCODES_DB_*` / credenciais Postgres | `server/src/app/Config/database.php`, `runcodes-api` (`DATABASE_URL`), `deploy/roles/data-postgres`, `deploy/vars/vars.yml` | Mesmo banco, configs devem casar entre apps e deploy |
| Lista de linguagens suportadas | `runcodes-compiler/src/rcc/languages.py` **e** `runcodes-compiler-images/<lang>/` **e** o catálogo `allowed_files` | Uma linguagem só funciona ponta a ponta se existir nos três lugares — ver [tipos de arquivo](../gestao/tipos-de-arquivo.md) |
| Concorrência do engine (`RUNCODES_COMPILER_CONCURRENCY`) | `RUNCODES_DB_POOL_MAX_SIZE` (derivado) e recursos do host Docker | Subir concorrência sem subir recursos gera contenção |

## As chaves S3 que não podem mudar

Os formatos de chave abaixo são lidos pelo `runcodes-compiler` com strings exatas — mudar o formato quebra a correção **silenciosamente** (o engine simplesmente não acha o objeto):

| Bucket | Chave | Escrito por | Lido por |
|---|---|---|---|
| `{prefix}-commits` | `aws_key` da tabela `commits` (opaca: `{exerciseId}/{uuid}-{nomeOriginal}`) | API no upload da submissão | Engine (download do fonte), API (histórico/`content`) |
| `{prefix}-cases` | **`{caseId}/in`** e **`{caseId}/out`** (exatas, não opacas) | API no CRUD de caso de teste | Engine (`download_file(f"{test_case.id}/in", ...)`) |
| `{prefix}-cases` | **`{caseId}/files/{filename}`** (arquivos de caso) | API (`ExerciseCaseFile`) | Engine (`fetch_test_case_files()`) |
| `{prefix}-files` | **`compilationfiles/{exerciseId}/{nome}`** — resolvido contra `exercise.real_id` quando ghost | API (upload de compilation file) | Engine (`fetch_exercise_file()`) |
| `{prefix}-outputfiles` | zip de saída por commit | Engine (`_store_results`) | server/API (exibição de saída) |

## O protocolo de sincronização engine ↔ container

O container de linguagem imprime em stdout, nesta ordem exata: `compilation.start` → `compilation.done` → `run.start` → `run.done`. O engine consome o stream de logs esperando cada mensagem (`expect_message()`), com timeouts de compilação/execução vindos da config e do tempo de CPU somado dos casos. É assim que ele sabe em que fase o commit está sem nenhum canal de comunicação além do stdout do container.

## A fila é a tabela `commits`

Qualquer sistema que insira uma linha válida em `commits` com `status = IN_QUEUE (0)` e um `aws_key` que resolva no bucket tem a submissão processada — foi assim que o `runcodes-api` plugou no engine **sem alterar uma linha de Python**. O claim é um `UPDATE ... SET status = PROCESSING WHERE id = ? AND status = IN_QUEUE` com checagem de rowcount — exclusão mútua entre múltiplas instâncias do engine, o que permite escalar o worker horizontalmente. Detalhes em [Pipeline](../operacao/pipeline.md).
