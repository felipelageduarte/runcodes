---
title: Courses, Offerings, Exercises
sidebar_position: 3
---

# Courses / Offerings / Exercises

Hierarquia: `course` (disciplina, ex. "SCC0219 - Estrutura de Dados") → `offering` (uma turma de um ano/período, ex. "2026/2 turma A") → `exercise` (um exercício dentro da turma).

## Regras de autorização (espelham o CakePHP)

| Rota | Quem acessa |
|---|---|
| `GET /api/courses` | Admin (type ≥ 3) |
| `GET /api/courses/search/mine` | Professor+ (type ≥ 2), escopado à própria universidade |
| `GET /api/offerings` | Qualquer autenticado |
| `GET /api/offerings/mine` | O próprio usuário — turmas em que está matriculado |
| `GET /api/offerings/:id` | Admin, ou matriculado na turma (qualquer papel) |
| `GET /api/exercises` | Admin (catálogo global) |
| `GET /api/exercises/:id` | Admin, staff da turma, ou aluno matriculado |

## Visibilidade de exercício: staff vs. aluno

Essa é a regra mais sutil, replicada de `OfferingsController::view()`:

- **Staff** (professor/assistente/admin) vê todo exercício não removido.
- **Aluno** só vê exercício com `open_date <= agora` **ou** `show_before_opening = true`.

Implementada em `ExerciseRepository.listVisible({ offeringId, includeUnopened })` — `includeUnopened` é decidido pelo `OfferingService`/`ExerciseService` com base em `isStaff`, nunca na rota.

## Exercício "ghost"

Um exercício pode ser `ghost = true` com `real_id` apontando para outro exercício (clone para outra turma que reaproveita configuração). Onde isso importa: resolução de extensões permitidas para submissão — ver [commits](./commits.md#extensões-permitidas).

## Paginação

Todas as listagens aceitam `page`/`pageSize` (default 1/20, máx. 100) e devolvem `{ total, page, pageSize, ... }`.
