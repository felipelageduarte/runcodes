---
title: Commits (submissão)
sidebar_position: 5
---

# Commits — submissão de código

O caminho crítico do produto: sem isso, nada mais importa. Ver [fluxo completo](../architecture/overview.md#fluxo-de-uma-submissão-commit).

## `POST /api/exercises/:exerciseId/commits`

Multipart, campo `files` (nome herdado do legado). Espelha `ExercisesController::commit()`.

Validações em ordem:

1. Exercício existe e não foi removido → senão `404`
2. Requester tem alguma matrícula na turma (aluno, assistente, professor ou admin) → senão `403 forbidden`
3. Exercício está aberto (`open_date <= agora < deadline`) **ou** requester é staff → senão `422 exercise_closed`
4. Extensão do arquivo está na allow-list do exercício (se houver uma configurada) → senão `422 file_type_not_allowed`
5. Tamanho do arquivo dentro do limite: **1MB para exercício compilável** (`type` ∈ {0, 2}), **5MB para não-compilável** (`type = 1`, ex. PDF para correção manual) → senão `422 file_too_large`

Se tudo passa:

- Upload do buffer pro bucket `runcodes-commits`, chave `{exerciseId}/{uuid}-{nome-original}`
- Insere linha em `commits` com `status = IN_QUEUE (0)` se compilável, `SUBMITTED (7)` se não-compilável (aguardando correção manual)

### Extensões permitidas

Resolvidas via `allowed_files_exercises` → `allowed_files`. Se o exercício é `ghost`, a allow-list é buscada pelo `real_id` (o exercício original), não pelo id do clone — mesma regra do CakePHP.

### Status de um commit

Espelha `Commit::get*StatusValue()`:

| Valor | Nome | Quando |
|---|---|---|
| 0 | IN_QUEUE | Aguardando o `compiler-engine` pegar |
| 1 | COMPILING | Em compilação |
| 2 | COMPILED | Compilado, aguardando execução |
| 4 | UNCOMPLETED | Rodou, nem todo caso passou |
| 5 | COMPLETED | Todos os casos passaram |
| 6 | ERROR | Erro de compilação/execução |
| 7 | SUBMITTED | Não-compilável, aguardando correção manual |
| 8 | PLAGIARISM | Marcado como plágio — ver [roadmap de detecção](../roadmap/plagiarism-detection.md) |
| 9 | SERVER_ERROR | Falha interna do engine |

## `GET /api/exercises/:exerciseId/commits`

Histórico do requester nesse exercício (não de outros alunos — isso é gestão de turma, backlog).

## `GET /api/commits/:id`

Usado para **polling** até o status sair de `IN_QUEUE`. Acesso: dono do commit, staff da turma, ou admin.

## Integração com o `compiler-engine`

O Node **nunca fala com o engine diretamente** — a única interface é a tabela `commits` (campo `status`) e o bucket S3 (campo `aws_key`, chave opaca). O engine (Python, repo `compiler-engine`) faz polling com:

```sql
SELECT ... FROM commits WHERE status = 0 ORDER BY commit_time ASC
```

e reivindica atomicamente com `UPDATE commits SET status = PROCESSING WHERE id = ? AND status = IN_QUEUE` (rowcount check evita corrida entre workers). Isso significa: **qualquer** sistema que escrever uma linha válida em `commits` com `status = 0` e um `aws_key` que resolva no bucket tem sua submissão processada — é assim que esse módulo plugou no engine existente sem alterar uma linha de Python. [Verificado com o engine real](./testing.md).

## Correção manual e reprocessamento

Mirrors `CommitsController::editScore()`/`recompile()`/`recompileAll()`:

- **`PUT /commits/:id/score`** (`editScore`) — staff da turma/admin sobrescreve nota/status de um commit manualmente.
- **`POST /commits/:id/recompile`** — reenfileira um commit específico (`status = IN_QUEUE`, limpa `compiled`/`compiled_message`/`corrects`/`score`, apaga os resultados de caso antigos). Não-admin não consegue se o commit já estiver em processamento; tipo não-compilável (`type = 1`) rejeita com `exercise_not_compilable`.
- **`POST /exercises/:id/commits/recompile-all`** — mesma coisa pro commit mais recente de cada aluno do exercício (não todo o histórico). Verificado contra o `compiler-engine` real: reenfileira, o engine reprocessa, apaga/recria `commits_exercise_cases`.

Achado pela [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md), fechado na [Fase 8](../frontend/roadmap.md#fase-8--ferramentas-de-correção-do-professor-).

### Ler commit específico do histórico

`GET /api/commits/:id/content` ([code-editor.md](../frontend/code-editor.md#get-apicommitsidcontent-)) já aceitava qualquer commit do dono ou de staff, mas até a [Fase 11](../frontend/roadmap.md#fase-11--polimento-residual-) só era usado pra pré-carregar a última submissão no editor. Cada `CommitCard` do histórico agora tem um botão "Ver código enviado" sob demanda — verificado abrindo duas submissões diferentes do mesmo exercício e confirmando que cada uma mostra seu próprio arquivo/conteúdo, não só a mais recente.

## Sinal de encerramento do processo (`compiledSignal`)

A coluna `compiled_signal` (ex. `SIGSEGV`, `SIGKILL`) sempre existiu no banco, escrita pelo `compiler-engine`, mas nunca tinha sido exposta por nenhuma rota — achado real na [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md) item 23 (antes "não confirmado"). Agora faz parte de `CommitRecord`; o frontend traduz os sinais mais comuns (SIGSEGV, SIGABRT, SIGFPE, SIGKILL etc.) pra uma frase em pt-BR dentro do `CommitCard`, junto com `compiled_message` (a saída bruta do compilador, que também não tinha UI nenhuma antes disso). Fechado na Fase 11.

## Export em zip dos casos de teste

`GET /api/exercises/:id/cases/download.zip` — mirrors `ExercisesController::downloadCases()`. Staff/admin baixa todos os casos; aluno só os que têm `showInput`/`showExpectedOutput` marcado, numerados `1.in`/`1.out`/`2.in`/... com um `README.txt`. Implementado em `ExerciseCaseService.buildCasesZip()` (ver [exercise-management.md](./exercise-management.md)). Fechado na Fase 11.
