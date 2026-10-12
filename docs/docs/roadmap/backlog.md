---
title: Backlog funcional
sidebar_position: 1
---

# O que falta no backend (`runcodes-api`)

O `server` (CakePHP) tem ~20 controllers. Portar 1:1 não é o objetivo — o objetivo é cobrir as mesmas funcionalidades com arquitetura melhor, na ordem de valor, não na ordem em que o PHP foi escrito. Ver [visão geral do backend](../backend/overview.md) pro que já está pronto.

## Feito

- ✅ **Cadastro de usuário** — `POST /api/users` (signup) + `POST /api/users/confirm`. Ver [users.md](../backend/users.md). Falta: reset de senha, reenvio de confirmação.
- ✅ **Gestão de turma** — promover/rebaixar professor/assistente, banir. Ver [enrollments.md](../backend/enrollments.md#gestão-de-turma-staff). Falta: exportação de notas (CSV), infográficos/stats por turma.
- ✅ **CRUD de exercícios e casos de teste** — criar/editar/apagar exercício, casos de teste (input/output em S3, na chave exata que o `compiler-engine` lê). Ver [exercise-management.md](../backend/exercise-management.md). Falta: upload de arquivos auxiliares de compilação/exercício, exercícios "ghost" (compartilhar entre turmas), import de `public_exercises`.
- ✅ **Detecção de plágio (Dolos + JPlag)** — fila assíncrona, worker separado, verificado com as ferramentas reais (não mock). Ver [plagiarism-detection.md](./plagiarism-detection.md). MOSS fica fora de escopo (serviço externo Stanford).

## Backlog (sem data)

- **Tickets e mensagens** — suporte aluno↔professor, sistema de alertas.
- **Emails transacionais** — confirmação de cadastro, recuperação de senha, notificações (hoje só existe no PHP via `smtp4dev` local / provedor real em produção). O signup já gera o token de confirmação — só falta o envio de fato.
- **Reset de senha** — token expirável + definição de nova senha pelo usuário (não replica o legado, que manda a senha em texto plano por email).
- **Questions / public_exercises** — banco de questões reutilizável, exercícios públicos (fora de turma).
- **Admin de universidades e usuários** — CRUD completo (hoje só signup+login existem, sem listagem/edição administrativa).
- **Notas/CSV e stats de turma** — `OfferingsController::grades/exportToCsv/infographic/stats`.

## Fora de escopo deliberado

- **Clonar o CakePHP 1:1.** Onde o padrão legado é claramente pior (ex. `recoveryPassword` envia a senha em texto plano por email), a versão nova implementa o equivalente funcional com prática atual (fluxo de token + definição de nova senha pelo usuário), não replica o comportamento antigo.
- **Reescrever `compiler-engine`/`compiler-monitor` em Node.** Ver [estratégia de migração](../architecture/migration-strategy.md) — sem justificativa técnica, é um serviço isolado que já funciona.
