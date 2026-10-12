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

Diferente do `type` do usuário (global) — um usuário `type=0` pode ter `role=2` numa turma específica se o admin o promoveu ali (gestão de turma, ver [roadmap](../roadmap/backlog.md)).
