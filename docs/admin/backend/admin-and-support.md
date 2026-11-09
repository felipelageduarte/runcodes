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
| `GET /api/admin/audit/feed` | Admin | Trilha de auditoria (`audit_log`): filtros `actor`, `method`, `status`, `route`, `since`, `until`, `q`; `limit` até 200, `offset`, `total` |
| `GET /api/admin/audit/stats` | Admin | KPIs, top ações, top usuários e série diária dos últimos `days` (até 90) |
| `GET /api/admin/logs` | Admin | Tabela `logs` legada, somente leitura (aba "Logs (legado)") |
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

`http/middleware/auditLog.ts`, montado globalmente em `app.ts`, antes dos routers. Desde a migration `007_audit_log.sql` (spec SDD `docs/specs/admin-e-separacao-front.md`, fase F1) grava na tabela `audit_log` **toda requisição** que chega à API (leitura inclusive: quem consultou dado pessoal também interessa), uma linha por resposta, no evento `finish`, independente do resultado (401/403 também são relevantes). Única exceção: `SKIP_PATHS` (`/api/health`).

Cada linha tem: ator (`actor_email`, `actor_type` = tipo real da conta), `view_as_type` quando o admin está em "ver como", método, `path` e `route` normalizada (`/offerings/12/members/a@x.com` vira `/offerings/:id/members/:email`), status, `duration_ms`, `ip` em `text` (IPv6 inteiro; a `logs` legada truncava em 15 caracteres), `user_agent`, `request_id` (reaproveita `X-Request-Id` do proxy ou gera um UUID, devolvido no cabeçalho da resposta) e `request_body` em `jsonb`.

Regras do corpo:

- **Redação**: toda chave que casa com `/password|token|secret|authorization|senha/i` vira `"[redacted]"`, em qualquer profundidade, antes de qualquer outra coisa.
- **Truncamento**: acima de 4000 caracteres de JSON, grava `{ truncated, size, preview }`.
- **Rotas contentless** (`CONTENTLESS_PATHS`: login, confirmação, pedido e reset de senha, `POST /api/admin/db/query`): só os nomes dos campos, nunca os valores. O SQL do console ganha campo próprio na F5.
- `GET`: só a query string (redigida), sem corpo.

Falha ao gravar nunca derruba a requisição (`catch` vazio, de propósito). Retenção: 180 dias (Q5 da spec), apagados pelo `worker.ts` na subida e a cada 24 h (`AuditService.purgeExpired`). Decisão: o job vive no worker, e não num SQL do `migrate.sh`, porque o migrate só roda no deploy.

Por que um middleware e não `Log::register()` chamada-por-chamada como no legado: um service não tem contexto HTTP; um ponto único cobre toda rota automaticamente, inclusive as criadas depois. A tabela `logs` legada fica somente leitura até vencer a retenção.

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
