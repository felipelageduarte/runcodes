---
title: Exercise management (CRUD)
sidebar_position: 3.5
---

# Criação e edição de exercícios e casos de teste

Professor/assistente/admin cria e mantém exercícios e seus casos de teste. Leitura (aluno vendo o exercício) está em [courses-offerings-exercises.md](./courses-offerings-exercises.md) — esse módulo é só autoria.

## Exercícios

- `POST /api/offerings/:offeringId/exercises` — cria. Staff da turma ou admin.
- `PUT /api/exercises/:id` — edita (todos os campos opcionais, PATCH-like).
- `DELETE /api/exercises/:id` — **soft delete** (`removed = true`), nunca apaga a linha. Cascateia pra clones "ghost" (`real_id = id`) — mirror exato de `ExercisesController::delete()`.

Upload de arquivos auxiliares (arquivos de compilação, arquivos extras do exercício) fica fora de escopo por enquanto — não implementado.

## Casos de teste (`ExerciseCase`)

- `GET /api/exercises/:exerciseId/cases` — lista. Qualquer matriculado (aluno incluso) pode ver, mas a resposta **nunca inclui o conteúdo de input/output** — só metadados (flags de visibilidade, limites de tempo/memória, hashes). Ver conteúdo de um caso individual (quando `show_input`/`show_expected_output` permite) não está implementado ainda.
- `POST /api/exercises/:exerciseId/cases` — cria. Staff/admin. Rejeita com `422 cases_not_supported_for_exercise_type` se o exercício for `type=1` (exercício "arquivo simples", sem casos de teste — mesma regra do legado).
- `PUT /api/exercise-cases/:id` — edita. Reenviar `input`/`output` reescreve o conteúdo no S3 e recalcula o hash; omitir o campo não toca nele.
- `DELETE /api/exercise-cases/:id` — apaga a linha e, best-effort, os objetos no S3.

### O contrato de S3 que não pode mudar

Input/output de cada caso vivem no bucket `runcodes-cases`, nas chaves **`{caseId}/in`** e **`{caseId}/out`** — exatas, não opacas como `commits.aws_key`. O `compiler-engine` (Python, `provider/storage/s3.py`) já faz:

```python
cases_bucket.download_file(f"{test_case.id}/in", destination)
```

Qualquer mudança nesse formato de chave quebra a correção de todo caso de teste existente, silenciosamente (o engine simplesmente não encontra o objeto). [Verificado em teste de integração](./testing.md): cria um caso pela API nova, lê de volta direto do S3 na chave exata, confirma que bate.

### Valores default herdados do legado

`maxmemsize` (4096), `stacksize` (2048) e `file_size` (10000) são os mesmos hardcoded que o CakePHP usa em `ExerciseCasesController::add()` — mantidos como default quando a API não recebe esses campos, não porque sejam bons valores, mas porque são o que todo caso existente já assume. Podem ser sobrescritos por requisição.
