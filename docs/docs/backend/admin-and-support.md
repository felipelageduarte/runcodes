---
title: Admin, notas, suporte
sidebar_position: 7
---

# Admin, notas e módulos de suporte

Os módulos menores — administração, notas e o entorno de suporte (tickets, avisos, FAQ, catálogo público). Cada um segue o mesmo padrão em camadas do resto do backend; agrupados aqui porque individualmente são pequenos.

## Admin

| Rota | Quem acessa | O que faz |
|---|---|---|
| `GET /api/universities` | Público | Lista universidades (um form de signup precisa disso antes de ter conta) |
| `POST/PUT /api/universities` | Admin | Criar/editar — valida abreviação única |
| `GET /api/allowed-files` | Qualquer autenticado | Catálogo de linguagens/tipos de arquivo aceitos em exercícios |
| `POST/PUT /api/allowed-files` | Admin | Gerenciar o catálogo |
| `GET/PUT /api/admin/users` | Admin | Listar (com filtros) e editar conta de qualquer usuário — resposta nunca inclui o hash de senha |
| `GET /api/admin/logs` | Admin | Leitura do log de auditoria — **nada escreve nessa tabela ainda**, ver [backlog](../roadmap/backlog.md) |

## Notas, stats e exports

Todos staff/admin-only (mesmo nível de acesso dos painéis de professor no legado).

| Rota | Mirrors | O que faz |
|---|---|---|
| `GET /api/offerings/:id/grades` | `OfferingsController::grades()` | Matriz aluno × exercício, cada célula com a nota do commit mais recente (ou `null` se nunca submeteu) |
| `GET /api/offerings/:id/grades/export.csv` | `OfferingsController::exportToCsv()` | A mesma matriz, em CSV — uma coluna com o identificador da universidade (`student_identifier_text`, ex. "NUSP"), nota 0.0 para quem nunca submeteu |
| `GET /api/exercises/:id/stats` | `ExercisesController::stats()` | % de acerto por caso de teste, com base no commit mais recente de cada aluno |
| `GET /api/exercises/:id/participants/:email/commits` | `ExercisesController::participantCommits()` | Histórico de commits de um aluno específico no exercício |
| `GET /api/offerings/:id/stats?participantEmail=` | `OfferingsController::stats()` | Média da turma por exercício; com `participantEmail`, sobrepõe as notas desse aluno |
| `GET /api/offerings/:id/infographic` | `OfferingsController::infographic()` | Agregado: nº de alunos, % com nota > 5, média geral |
| `GET /api/exercises/:id/export-submissions.zip` | `ExercisesController::getAllScoresZipped()` | Zip com a submissão mais recente de cada aluno, uma pasta por aluno |

Todos reaproveitam `CommitRepository.listLatestPerStudentForExercise` — a mesma query de "último commit por aluno" que o worker de plágio usa.

O zip é a única diferença estrutural do legado: o `getAllScoresZipped()` monta o arquivo em disco local, re-sobe pro S3, e redireciona o navegador pra uma URL pré-assinada — só pra contornar o fato de rodar atrás de um load balancer sem disco compartilhado. Aqui, `ExerciseExportService` busca cada arquivo de commit do S3 e monta o zip (via `archiver`) direto na resposta HTTP, sem round-trip extra.

## Tickets (suporte)

Espelha `TicketsController` exatamente: qualquer autenticado abre um ticket (`POST /api/tickets`), mas gerenciar a fila (global, não por turma) exige assistente+ (`type >= 1`).

```
POST /api/tickets                (qualquer autenticado)
GET  /api/tickets/mine           (qualquer autenticado — não existe no legado, mas sem isso
                                   quem abre um ticket não tem como acompanhar)
GET  /api/tickets                (assistente+)
GET  /api/tickets/:id            (dono do ticket, ou assistente+)
PUT  /api/tickets/:id            (assistente+)
PUT  /api/tickets/:id/solve      (assistente+)
PUT  /api/tickets/:id/close      (assistente+)
DELETE /api/tickets/:id          (assistente+)
```

## Alerts (avisos)

:::warning Não é clone do legado
O `AlertsController` legado **não tem `isAuthorized()` próprio** — herda o default de `AppController` (`return true`), ou seja, qualquer usuário autenticado, incluindo aluno, pode publicar/editar/apagar avisos site-wide. Isso lê como falha, não decisão de produto. Aqui, escrita exige staff+ (`type >= ASSISTANT`); leitura de avisos ativos continua aberta a qualquer autenticado.
:::

Achamos um bug real escrevendo o teste disso: o `create()` do `AlertService` chamava a checagem de permissão de forma síncrona sem a função ser `async` — o `throw` escapava antes da promise rejeitar, e `expect(...).rejects` não capturava. Corrigido; auditamos todo o resto dos services novos atrás do mesmo padrão (não achamos outro caso).

## Questions (FAQ)

Catálogo pequeno, admin escreve, leitura pública — espelha `QuestionsController` (que já permitia leitura sem login via `Auth->allow('modal')`).

## Public exercises

`POST /api/public-exercises/:exerciseId` (professor+, **checagem global** — não precisa ser staff daquela turma específica, igual ao `isAuthorized` do legado) marca um exercício como reutilizável; publicar o mesmo exercício duas vezes dá `409`. `GET /api/public-exercises` lista o catálogo (professor+).
