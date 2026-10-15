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
| `POST /api/admin/users` | Admin | Cria conta já confirmada, sem round-trip de email — mirrors `UsersController::insert()`. Fechado na [Fase 10](../frontend/roadmap.md#fase-10--gestão-de-turma-avançada-) |
| `DELETE /api/admin/users/:email` | Admin | Hard delete, cascata via FK (matrículas/commits somem junto) — mirrors `UsersController::delete()`. Sem como desfazer |
| `GET /api/admin/logs` | Admin | Leitura do log de auditoria |
| `GET /api/admin/stats/activity` | Admin | Volume de submissões da plataforma inteira (hoje/ontem/7 dias + tendência de 28 dias) — ver abaixo |

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

## Atividade global da plataforma

`StatsService.getPlatformActivity()` — mirrors `StatsController::commitsInfographic()`/`commitsChart()`, mas agregado em memória a partir de `CommitRepository.listSince()` (busca commits dos últimos 28 dias, conta por dia em JS) em vez de SQL agregado — mesmo trade-off de escala que o `MarketplaceStatsService` já assume, aceitável no volume esperado. Diferente do resto deste módulo, não é por turma/exercício: é a plataforma inteira. Achado na [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md) item 20, fechado na [Fase 11](../frontend/roadmap.md#fase-11--polimento-residual-).

## Log de auditoria (escrita)

`http/middleware/auditLog.ts`, montado globalmente em `app.ts`. Mirrors `Log::register()` — que o legado chama manualmente de ~60 pontos nos controllers — mas de um único lugar: toda requisição mutante (`POST`/`PUT`/`PATCH`/`DELETE`) autenticada gera uma linha de log depois da resposta ser enviada, independente do resultado (uma ação negada também é relevante pra auditoria).

Essa é a diferença de design chave vs. o legado: um service não tem contexto HTTP, então replicar `Log::register()` chamada-por-chamada significaria espalhar a preocupação de logging em cada método de cada service — o tipo de acoplamento ad-hoc que essa migração está evitando. Um middleware HTTP único resolve isso sem tocar em nenhum service, e cobre toda rota de mutação automaticamente, inclusive as que forem criadas depois.

Trade-off, dito sem rodeios: a mensagem perde a prosa do legado (`"Enrolled in the offering #5"`) e vira `"POST /api/enrollments -> 201"` — mesmo who/what/when/result, menos narrativa.

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

:::info Resolvido na Fase 9 (auditoria out/2026)
O backend sempre leu avisos ativos sem gate de staff, mas até a [Fase 9](../frontend/roadmap.md#fase-9--comunicação-avisos-e-broadcast-) **nenhuma tela do `runcodes-web` consumia isso fora da aba de gestão de staff** — o aluno nunca via um aviso publicado. Fechado com `AlertsBanner` no `AppShell` (zero mudança de backend — o endpoint já existia). Detalhe em [auditoria de paridade](../roadmap/gap-audit-2026-10.md).
:::

## Questions (FAQ)

Catálogo pequeno, admin escreve, leitura pública — espelha `QuestionsController` (que já permitia leitura sem login via `Auth->allow('modal')`).

## Public exercises

`POST /api/public-exercises/:exerciseId` (professor+, **checagem global** — não precisa ser staff daquela turma específica, igual ao `isAuthorized` do legado) marca um exercício como reutilizável; publicar o mesmo exercício duas vezes dá `409`. `GET /api/public-exercises` lista o catálogo (professor+).

## Broadcast de email administrativo

`POST /api/messages` (admin-only) — mirrors `MessagesController::sendMail()`, mas deliberadamente mais simples: **sem** pixel de rastreio de abertura, **sem** blacklist de endereço, **sem** anexo. O gap era real (achado na [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md), item 9) — o legado tem esse controller inteiro sem equivalente — mas a versão nova não clona o rastreio de abertura por pixel de propósito: é vigilância sobre o destinatário, não uma funcionalidade que o produto precisa, e o legado nunca tratou bem a implicação de privacidade disso.

```
POST /api/messages   { "audience": "students" | "staff" | "admins" | "all", "subject", "message" }
GET  /api/messages?page=&pageSize=   (histórico, admin-only)
```

`audience` resolve pra uma faixa de `type` (não um valor exato só pra "staff"/"admins"):

| Audiência | Faixa de `type` | Nota |
|---|---|---|
| `students` | exatamente `STUDENT` (0) | **não** `>= STUDENT` — isso incluiria todo mundo, bug real encontrado e corrigido durante a verificação manual desta feature (testado no smtp4dev: "Alunos" mandava pro admin também, antes do fix) |
| `staff` | `ASSISTANT`–`ADMIN-1` | assistente + professor. Legado nunca tinha uma opção que incluísse assistente (só "Professores" exato) — isso lê como lacuna do legado, não repetida aqui |
| `admins` | `>= ADMIN` | admin + developer |
| `all` | `>= STUDENT` (sem teto) | todo mundo confirmado |

Envio é best-effort por destinatário (`Promise.allSettled`) — um endereço inválido não derruba o broadcast inteiro. Histórico fica na tabela `messages` legada, reaproveitada em vez de criar uma nova: migração `006_add_broadcast_fields_to_messages.sql` adiciona `sender_email`/`sent_at`/`recipient_count` (o legado só gravava o conteúdo, nunca quem mandou nem quando — isso vivia só no log de auditoria separado).
