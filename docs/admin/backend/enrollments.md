---
title: Enrollments
sidebar_position: 4
---

# Enrollments

## `POST /api/enrollments`

Auto-matrícula por código de turma — espelha `EnrollmentsController::add()`.

```json
// request
{ "enrollment_code": "ABC123" }
```

Validações, em ordem, cada uma com seu próprio erro:

1. Código existe? → `404 invalid_enrollment_code`
2. Turma pertence à mesma universidade do usuário? → `403 wrong_university`
3. Já matriculado? → `409 already_enrolled`
4. Foi banido dessa turma antes? → `409 banned_from_offering`
5. Cria enrollment com `role = 0` (aluno) — matrícula via código nunca cria professor/assistente.

Código é case-insensitive (normalizado para maiúsculo no repositório).

## `GET /api/enrollments/mine`

Lista as matrículas do usuário autenticado (não-banidas).

## Papéis de matrícula

| Valor | Papel |
|---|---|
| 0 | Aluno |
| 1 | Assistente/monitor |
| 2 | Professor |

Diferente do `type` do usuário (global) — um usuário `type=0` pode ter `role=2` numa turma específica se foi promovido ali (gestão de turma, abaixo).

## Gestão de turma (staff)

Implementado em `OfferingMembershipService` — deliberadamente separado do `EnrollmentService`: matricular a si mesmo (aluno) e gerenciar membros de outros (staff) são atores diferentes, com regras de autorização diferentes, sobre o mesmo agregado.

### `PUT /api/offerings/:id/members/:email/role`

```json
{ "role": 2 }
```

Promove/rebaixa um membro já matriculado. Requer staff da turma (professor/assistente) **ou** admin. Se o alvo não tem matrícula na turma → `404 user_not_enrolled` (promoção não cria matrícula, só muda o papel de quem já está).

### `POST /api/offerings/:id/members/:email/ban`

Bane um membro da turma (`banned = true` — soft, não deleta a matrícula). **Admin-only** — nem professor nem assistente podem, espelhando o CakePHP legado (`OfferingsController::ban()` não está na lista `professorAuthorized`, mantido de propósito: um professor não deveria conseguir remover um aluno unilateralmente da própria turma, sem supervisão).

Verificado em teste de integração real: um admin promove um aluno matriculado a professor, esse novo professor consegue se autogerenciar (demover a si mesmo), mas **não** consegue banir ninguém — só admin consegue.

### `POST /api/offerings/:id/members/:email`

Matricula alguém diretamente, sem código — mirrors `EnrollmentsController::enroll()`. Staff da turma **ou** admin (o legado restringia isso a admin-only, já que não está em `professorAuthorized` nem `studentAuthorized`; ampliado aqui pra mesma régua das outras ações de gestão de turma — ver [auditoria de paridade](../roadmap/gap-audit-2026-10.md) item 6). Mesma validação de universidade do `enrollByCode`; `409 already_enrolled`/`banned_from_offering` se já houver matrícula.

### `DELETE /api/offerings/:id/members/:email`

Desmatrícula "dura" — apaga a linha de matrícula, diferente de `ban` (soft, admin-only acima). Mirrors `EnrollmentsController::delete()`, que no legado já era staff-da-turma-ou-admin (está em `professorAuthorized`), não admin-only.

### `POST /api/offerings/:id/email`

Email avulso pra todo mundo matriculado na turma (staff e alunos, não-banidos) — mirrors `OfferingsController::email()`. Staff da turma ou admin. O legado não filtrava membros banidos; aqui filtra (mandar email pra alguém removido da turma não é útil).
