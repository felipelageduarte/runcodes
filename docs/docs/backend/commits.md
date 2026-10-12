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
