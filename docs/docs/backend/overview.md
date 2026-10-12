---
title: runcodes-api — visão geral
sidebar_position: 1
---

# runcodes-api

Express + TypeScript + Prisma. Substitui o `server` (CakePHP) incrementalmente — ver [estratégia de migração](../architecture/migration-strategy.md).

## Arquitetura em camadas

```
src/
  domain/errors.ts        → erros tipados (NotFoundError, ForbiddenError, ...)
  repositories/            → 1 interface + 1 implementação Prisma por agregado
  services/                 → regra de negócio pura, sem Express nem Prisma
  http/
    routes/                → controllers finos: valida input (Zod), chama service, responde
    middleware/
  container.ts             → composition root — único lugar que instancia Prisma/S3
  app.ts / server.ts
```

### Por que essa estrutura

- **Repository pattern**: services dependem de interfaces (`UserRepository`, `CommitRepository`, ...), nunca do `PrismaClient` ou do AWS SDK diretamente. Trocar Postgres por outro banco, ou mockar em teste, nunca toca `services/`.
- **Erros de domínio tipados**: cada erro (`NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`, `UnauthorizedError`) carrega seu próprio HTTP status e `code`. Um único middleware (`http/middleware/errorHandler.ts`) mapeia tudo — zero `instanceof` espalhado pelas rotas.
- **Composition root** (`container.ts`): o único arquivo que sabe que existe Prisma ou S3. Todo o resto do código importa só interfaces.

Essa arquitetura foi uma refatoração deliberada — a primeira versão dos módulos importava o Prisma client como singleton global e tinha `instanceof` em cada rota. Funcionava, mas não escalava nem era testável sem banco real.

## Módulos implementados

| Módulo | Rotas | O que faz |
|---|---|---|
| [Auth](./auth.md) | `POST /api/auth/login` | Login, JWT, migração transparente sha1→bcrypt, bloqueia login não-confirmado |
| [Users](./users.md) | `POST /api/users`, `POST /api/users/confirm` | Cadastro (signup) + confirmação de email com token aleatório expirável |
| [Courses/Offerings/Exercises](./courses-offerings-exercises.md) | `GET /api/{courses,offerings,exercises}*` | Leitura, com as mesmas regras de visibilidade do CakePHP legado |
| [Exercise management](./exercise-management.md) | `POST/PUT/DELETE /api/exercises*`, `.../cases` | Criar/editar/apagar exercício e casos de teste (staff/admin) |
| [Enrollments](./enrollments.md) | `POST /api/enrollments`, `PUT .../members/:email/role`, `POST .../members/:email/ban` | Entrar em turma por código + gestão de turma (promover, banir) |
| [Commits](./commits.md) | `POST/GET /api/exercises/:id/commits`, `GET /api/commits/:id` | Submissão de código — upload S3 + fila pro `compiler-engine` |
| [Plagiarism detection](../roadmap/plagiarism-detection.md) | `POST/GET /api/exercises/:id/plagiarism-runs`, `GET /api/plagiarism-runs/:id` | Dolos + JPlag, fila assíncrona (BullMQ/Redis), worker separado |
| [Admin & suporte](./admin-and-support.md) | universidades, allowed-files, admin de usuários, logs, notas, tickets, alerts, questions, public-exercises | Os módulos menores — ver página dedicada |

Ver [roadmap](../roadmap/backlog.md) para o que ainda falta.

## Testes

Ver [testing.md](./testing.md) — dois níveis (unitário com mock de repositório, integração contra `local-dev` real). 165 unitários + 37 de integração, todos passando — incluindo Dolos e JPlag rodando de verdade (não mock) no teste de integração.
