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
- `POST /api/exercises/:id/share` — compartilha o exercício com outra turma como clone "ghost" (`ghost=true`, `real_id` apontando pro original). Autorização exige staff/admin da turma **de destino** (não da turma original) — mirror exato de `Exercise::createGhostExercise()`. Casos, allow-list de arquivo e anexos ficam todos no exercício real; todo módulo que lê isso já redireciona via `real_id`.
- `POST /api/exercises/:id/clone` — cópia **independente** (não ghost, `ExerciseManagementService.cloneExercise()`): duplica enunciado, allow-list de arquivo e casos de teste (conteúdo próprio, re-hasheado, verificado em teste de integração que o hash do clone é diferente do original). Mesma régua de autorização do `share` (staff/admin do destino + publicado ou staff da origem). Título vira "`<original> (cópia)`". **Anexos** (`ExerciseFile`/`CompilationFile`) **não são clonados** — decisão de escopo: reanexar um PDF/arquivo de apoio é o mesmo esforço de autoria de qualquer forma, o ganho real está nos casos de teste. Achado na [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md) item 16, fechado na [Fase 11](../frontend/roadmap.md#fase-11--polimento-residual-).

## Arquivos (exercise files e compilation files)

Upload direto via multipart — uma única requisição, sem o vai-e-vem de duas fases do legado (upload pra um S3 temporário, depois "copiar" pro destino no save do form — resquício da UX do widget jQuery File Upload antigo).

```
GET/POST  /api/exercises/:id/files                   (listar / subir — staff+ pra upload, qualquer matriculado pra listar)
GET       /api/exercise-files/:id/download
DELETE    /api/exercise-files/:id                     (staff+)

GET/POST  /api/exercises/:id/compilation-files        (mesma forma, arquivo usado na compilação)
GET       /api/compilation-files/:id/download
DELETE    /api/compilation-files/:id
```

Extensões bloqueadas (`exe`, `php`, `htm`, `html`) são rejeitadas **no upload**, não só no download como o legado fazia — não tem sentido aceitar um arquivo que nunca vamos concordar em servir de volta. Toda resposta de download usa `application/octet-stream` independente do tipo real do arquivo, então nada é servido de um jeito que o navegador tentaria executar.

### Compilation files: outro contrato de S3 que não pode mudar

Vivem em `compilationfiles/{exerciseId}/{nome}` dentro do bucket `{prefix}-files` — o `runcodes-compiler` (`fetch_exercise_file()`) lê exatamente essa chave, resolvendo `compilation_files.path` (só o nome do arquivo) contra `exercise.real_id` quando o exercício é ghost. [Verificado](./testing.md): upload pela API, leitura direta do SeaweedFS na chave exata.

## Casos de teste (`ExerciseCase`)

- `GET /api/exercises/:exerciseId/cases` — lista. Qualquer matriculado (aluno incluso) pode ver, mas a resposta **nunca inclui o conteúdo de input/output** — só metadados (flags de visibilidade, limites de tempo/memória, hashes). Ver conteúdo de um caso individual (quando `show_input`/`show_expected_output` permite) não está implementado ainda.
- `POST /api/exercises/:exerciseId/cases` — cria. Staff/admin. Rejeita com `422 cases_not_supported_for_exercise_type` se o exercício for `type=1` (exercício "arquivo simples", sem casos de teste — mesma regra do legado).
- `PUT /api/exercise-cases/:id` — edita. Reenviar `input`/`output` reescreve o conteúdo no S3 e recalcula o hash; omitir o campo não toca nele.
- `DELETE /api/exercise-cases/:id` — apaga a linha e, best-effort, os objetos no S3.

### O contrato de S3 que não pode mudar

Input/output de cada caso vivem no bucket `runcodes-cases`, nas chaves **`{caseId}/in`** e **`{caseId}/out`** — exatas, não opacas como `commits.aws_key`. O `runcodes-compiler` (Python, `provider/storage/s3.py`) já faz:

```python
cases_bucket.download_file(f"{test_case.id}/in", destination)
```

Qualquer mudança nesse formato de chave quebra a correção de todo caso de teste existente, silenciosamente (o engine simplesmente não encontra o objeto). [Verificado em teste de integração](./testing.md): cria um caso pela API nova, lê de volta direto do S3 na chave exata, confirma que bate.

### Valores default herdados do legado

`maxmemsize` (4096), `stacksize` (2048) e `file_size` (10000) são os mesmos hardcoded que o CakePHP usa em `ExerciseCasesController::add()` — mantidos como default quando a API não recebe esses campos, não porque sejam bons valores, mas porque são o que todo caso existente já assume. Podem ser sobrescritos por requisição.

## Casos de teste baseados em arquivo (`ExerciseCaseFile`)

Além do input/output de texto inline acima, um caso pode ter um ou mais arquivos anexados — um programa que lê um arquivo de dados, por exemplo. Mirrors `ExerciseCaseFilesController`, mas sem a dança de duas fases do legado (upload pra uma chave temporária, depois "anexar" no save do caso — artefato do widget jQuery de upload do legado): aqui é um único request multipart.

```
GET    /api/exercise-cases/:exerciseCaseId/files            (staff/admin)
POST   /api/exercise-cases/:exerciseCaseId/files            (staff/admin, multipart, campo "file")
GET    /api/exercise-case-files/:id/download                (staff/admin)
DELETE /api/exercise-case-files/:id                         (staff/admin)
```

**Staff/admin-only em tudo**, diferente de `ExerciseFile`/`CompilationFile` (que aluno matriculado também lê): o arquivo de input de um caso é material de correção, não algo que o aluno deveria ver.

Mesmo contrato de S3 do input/output de texto: chave **`{caseId}/files/{filename}`**, no mesmo bucket `runcodes-cases`. `runcodes-compiler` já lê isso (`fetch_test_case_files()`) — só faltava o lado do Node escrever. Apagar um caso agora limpa tanto `{caseId}/in`/`{caseId}/out` quanto todo arquivo sob `{caseId}/files/` (via `ListObjectsV2` + batch delete), não só os dois primeiros.

## Operações em lote

Além do CRUD individual acima, mirrors `ExerciseCasesController::addBatch()`/`removeAllCases()` (achados pela [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md), fechados na [Fase 8](../frontend/roadmap.md#fase-8--ferramentas-de-correção-do-professor-)):

- **`POST /api/exercises/:id/cases/batch`** — cria vários casos de uma vez, config compartilhada (tipo de saída, cputime, visibilidade). Diferente do legado, recebe o texto de input/output direto no corpo da requisição em vez de upload de arquivos `.in`/`.out` casados por nome — mesmo ganho de produtividade (não precisa criar um por um), contrato mais simples por ser API, não form HTML. Para no primeiro erro; casos já criados antes dele permanecem.
- **`PUT /api/exercises/:id/cases/visibility`** — aplica `showInput`/`showExpectedOutput`/`showUserOutput` a todos os casos do exercício de uma vez.
- **`DELETE /api/exercises/:id/cases`** (`removeAllCases`) — apaga todos os casos do exercício, best-effort nos objetos S3.
- **`GET /api/exercises/:id/cases-table`** (`casesTable`) — matriz aluno × caso ("quem passou em qual caso"), em `StatsService`, diferente do agregado por caso de `getExerciseCaseStats` ([admin-and-support.md](./admin-and-support.md)). Também devolve `hasUnsafeCommits`: `true` quando o commit mais recente de algum aluno é anterior à última mudança nos casos (`exercise_cases.last_update`) — sinal de que a nota pode não refletir a régua atual.
- **`GET /api/exercises/:id/cases/download.zip`** (`downloadCases`) — zip dos inputs/outputs via `ExerciseCaseService.buildCasesZip()`. Staff/admin baixa tudo; aluno só os casos com `showInput`/`showExpectedOutput` marcado (checado por caso, igual ao legado). Numerado `1.in`/`1.out`/`2.in`/... com `README.txt`. Achado na auditoria de paridade de out/2026 item 18, fechado na [Fase 11](../frontend/roadmap.md#fase-11--polimento-residual-).
