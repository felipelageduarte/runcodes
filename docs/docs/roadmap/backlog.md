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
- ✅ **Notas (grades matrix) + export CSV** — `GET /api/offerings/:id/grades`, matriz aluno × exercício; `GET /api/offerings/:id/grades/export.csv` pra exportar.
- ✅ **Stats/infográficos** — correção por caso (`GET /api/exercises/:id/stats`), histórico de commit de um aluno (`GET /api/exercises/:id/participants/:email/commits`), média da turma por exercício (`GET /api/offerings/:id/stats`), infográfico agregado (`GET /api/offerings/:id/infographic`), zip com a última submissão de cada aluno (`GET /api/exercises/:id/export-submissions.zip`, streamado direto do S3 em vez do vai-e-vem por disco local do legado).
- ✅ **Envio real de email** — `EmailSender`/`SmtpEmailSender` (nodemailer) substitui o placeholder que devolvia o token bruto na resposta HTTP. `local-dev` expõe a porta SMTP do `smtp4dev` (2525), testado de ponta a ponta via a API REST dele. Ver [users.md](../backend/users.md).
- ✅ **Admin** — universidades, tipos de arquivo permitido, usuários (CRUD), logs (leitura).
- ✅ **Tickets, alerts, questions, public-exercises** — suporte, avisos, FAQ, catálogo de exercícios reutilizáveis.
- ✅ **Upload de arquivo** (`ExerciseFile`/`CompilationFile`) **e exercícios "ghost"** — upload direto multipart pro S3 (sem o vai-e-vem de duas fases do legado), compartilhamento de exercício entre turmas. Ver [exercise-management.md](../backend/exercise-management.md). `ExerciseCaseFile` (caso de teste baseado em arquivo, não texto inline) ainda não — ver abaixo.
- ✅ **Log de auditoria (escrita)** — um middleware Express (`http/middleware/auditLog.ts`), montado globalmente, registra toda requisição de mutação (POST/PUT/PATCH/DELETE) autenticada, em vez de 60+ chamadas a `Log::register()` espalhadas pelos controllers legados. Mensagem perde a prosa do legado ("Enrolled in the offering #5" → "POST /api/enrollments -> 201"), mas cobre toda rota de mutação automaticamente, inclusive as criadas depois.

## Backlog real (não implementado)

- **Casos de teste baseados em arquivo** (`ExerciseCaseFile`) — hoje `ExerciseCaseService` só aceita input/output como texto inline; o legado também suporta casos cujo input é um arquivo binário. Mesma infra de upload do `ExerciseAttachmentService` daria conta, não implementado ainda.

## Fora de escopo deliberado

- **Clonar o CakePHP 1:1.** Onde o padrão legado é claramente pior (ex. `recoveryPassword` envia a senha em texto plano por email; `AlertsController` sem `isAuthorized`, permitindo qualquer usuário autenticado publicar avisos site-wide), a versão nova implementa o equivalente funcional com prática atual — nunca replica um bug ou brecha de segurança do legado só por paridade.
- **Reescrever `compiler-engine`/`compiler-monitor` em Node.** Ver [estratégia de migração](../architecture/migration-strategy.md) — sem justificativa técnica, é um serviço isolado que já funciona.
- **`CookiesController`/`PagesController`/`TestsController`.** Banner de cookies e páginas estáticas são responsabilidade do frontend, não da API; `TestsController` é ferramenta de debug interna do time, não requisito de produto.
