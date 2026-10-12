---
title: Backlog funcional
sidebar_position: 1
---

# O que falta no backend (`runcodes-api`)

O `server` (CakePHP) tem ~20 controllers. Portar 1:1 não é o objetivo — o objetivo é cobrir as mesmas funcionalidades com arquitetura melhor, na ordem de valor, não na ordem em que o PHP foi escrito. Ver [visão geral do backend](../backend/overview.md) pro que já está pronto.

## Feito

- ✅ **Auth completo** — login, signup, confirmação de email, reenvio de confirmação, reset de senha (fluxo por token, não a senha em texto plano que o legado manda por email). Ver [auth.md](../backend/auth.md) e [users.md](../backend/users.md).
- ✅ **Courses/Offerings/Exercises** — leitura com as mesmas regras de visibilidade do legado, CRUD de exercício e casos de teste. Ver [courses-offerings-exercises.md](../backend/courses-offerings-exercises.md) e [exercise-management.md](../backend/exercise-management.md).
- ✅ **Gestão de turma** — matrícula por código, promover/rebaixar professor/assistente, banir. Ver [enrollments.md](../backend/enrollments.md).
- ✅ **Submissão de código** — upload S3, fila pro `compiler-engine`, resultado por caso de teste. Ver [commits.md](../backend/commits.md).
- ✅ **Detecção de plágio (Dolos + JPlag)** — fila assíncrona, worker separado, verificado com as ferramentas reais. Ver [plagiarism-detection.md](./plagiarism-detection.md). MOSS fora de escopo (serviço externo Stanford).
- ✅ **Notas (grades matrix)** — `GET /api/offerings/:id/grades`, matriz aluno × exercício.
- ✅ **Admin** — universidades, tipos de arquivo permitido, usuários (CRUD), logs (leitura).
- ✅ **Tickets, alerts, questions, public-exercises** — suporte, avisos, FAQ, catálogo de exercícios reutilizáveis.

## Backlog real (não implementado)

- **Upload de arquivo auxiliar** — `ExerciseFile`/`CompilationFile`/`ExerciseCaseFile` do legado: arquivos de apoio à compilação, material extra do exercício, casos de teste baseados em arquivo (hoje só input/output inline como texto é suportado). Precisa de infra de upload multipart + S3 por tipo, não implementado.
- **Exercícios "ghost"** — compartilhar o mesmo exercício entre turmas diferentes (clone leve apontando pro original). O campo `ghost`/`real_id` já existe no schema e é respeitado onde relevante (ex. delete cascateia, cases redirecionam pro original), mas não há endpoint pra *criar* um ghost a partir de um exercício existente.
- **Envio real de email** — `POST /api/users` e as rotas de confirmação/reset já geram o token certo; falta o serviço de envio de fato (hoje a API devolve o token bruto na resposta, documentado como provisório). `local-dev` já tem `smtp4dev` rodando, pronto pra um `MessagesController`-equivalente consumir.
- **Stats/infográficos detalhados** — `ExercisesController::stats/participantCommits/getAllScoresZipped`, `OfferingsController::infographic/exportToCsv`. A matriz de notas cobre o caso de uso principal (ver nota por aluno/exercício); gráficos e exportação CSV ainda não.
- **Log de auditoria (escrita)** — o legado chama `Log::register()` em quase toda ação de mutação; a leitura (`GET /api/admin/logs`) já existe, mas nada no `runcodes-api` escreve nessa tabela ainda. Virar isso um cross-cutting concern de verdade (middleware/decorator) é trabalho de design, não um patch pontual.

## Fora de escopo deliberado

- **Clonar o CakePHP 1:1.** Onde o padrão legado é claramente pior (ex. `recoveryPassword` envia a senha em texto plano por email; `AlertsController` sem `isAuthorized`, permitindo qualquer usuário autenticado publicar avisos site-wide), a versão nova implementa o equivalente funcional com prática atual — nunca replica um bug ou brecha de segurança do legado só por paridade.
- **Reescrever `compiler-engine`/`compiler-monitor` em Node.** Ver [estratégia de migração](../architecture/migration-strategy.md) — sem justificativa técnica, é um serviço isolado que já funciona.
- **`CookiesController`/`PagesController`/`TestsController`.** Banner de cookies e páginas estáticas são responsabilidade do frontend, não da API; `TestsController` é ferramenta de debug interna do time, não requisito de produto.
