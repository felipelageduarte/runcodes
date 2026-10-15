---
title: Banco de dados
sidebar_position: 2
---

# Banco de dados (Postgres)

O repo `database` é a fonte única de verdade do schema, compartilhado por `server` (ORM CakePHP), `runcodes-api` (Prisma via introspecção — `prisma db pull`, o schema nunca é redesenhado pelo Prisma) e `runcodes-compiler` (SQL raw via psycopg).

## Variantes de schema (`schema/`)

| Arquivo | Conteúdo |
|---|---|
| `base.sql` | Só estrutura (tabelas/constraints/índices) |
| `development.sql` | `base.sql` + dados de exemplo (usuários, universidades) |
| `production.sql` | `base.sql` + apenas o usuário admin inicial |

`docker/Dockerfile.development` e `docker/Dockerfile.production` estendem a imagem oficial `postgres` injetando o SQL correspondente (`make development` / `make production`). Migrações incrementais do `runcodes-api` vivem em `database/migrations/` (ex.: `001_widen_users_password.sql` pro bcrypt, `003` pra `plagiarism_runs`, `006` pros campos de broadcast em `messages`).

## Tabelas principais

| Tabela | Papel |
|---|---|
| `users` | Contas (alunos, professores, admins) — `type` global: 0 aluno, 1 assistente, 2 professor, 3 admin, 4 developer |
| `universities` | Multi-tenant por instituição |
| `courses` → `offerings` → `enrollments` | Disciplina → turma/oferta → matrícula (`role` por turma: 0 aluno, 1 assistente, 2 professor) |
| `exercises` | Definição de exercício (linguagem, enunciado, datas, `ghost`/`real_id` pra clones vinculados) |
| `exercise_cases` | Casos de teste (tipo de comparação, erro absoluto permitido, tempo de CPU, visibilidade, `last_update` — base do aviso de "unsafe commits") |
| `exercise_case_files` | Arquivos de apoio por caso de teste |
| `exercise_files` / `compilation_files` | Anexos do exercício (download do aluno / entram na compilação) |
| `allowed_files` / `allowed_files_exercises` | Catálogo de extensões e o vínculo por exercício |
| `commits` | **A submissão** — status, score, `aws_key` (S3), `compiled_message`, `compiled_signal`. É a fila do engine |
| `commits_exercise_cases` | Resultado por caso de teste de cada commit |
| `public_exercises` / `questions` | Marketplace/catálogo público e FAQ |
| `plagiarism_runs` | Execuções de detecção de plágio (provider, status, resultado jsonb) |
| `tickets` / `messages` / `alerts` | Suporte, broadcast de email, avisos |
| `logs` / `mail_logs` / `blacklist_mails` | Auditoria e email |
| `ganglia` / `disk_reports` / `droplets` / `jail_status` / `cria_*` | Integrações legadas de infraestrutura — confirmar uso real antes de depender delas em código novo |

## Regra de ouro pra mudança de schema

Qualquer mudança começa **no repo `database`** e precisa ser propagada pra todos os leitores:

1. `database/schema/base.sql` (+ migração incremental em `database/migrations/`).
2. `server/src/app/Model/*.php` (e `Config/Schema/`, se aplicável).
3. `runcodes-api` — `prisma db pull` + ajuste dos repositórios.
4. `runcodes-compiler/src/rcc/model/*.py` e as queries em `provider/data/postgres.py` — **somente** se a mudança tocar `commits`, `exercise_cases`, `exercise_case_files` ou `commits_exercise_cases`.

A tabela completa de acoplamentos está em [Contratos entre módulos](../architecture/contratos.md).

## Status de um commit (referência rápida)

| Valor | Nome | Quando |
|---|---|---|
| 0 | IN_QUEUE | Aguardando o engine |
| 1 | COMPILING | Em compilação |
| 2 | COMPILED | Compilado, rodando casos |
| 4 | UNCOMPLETED | Rodou, nem todo caso passou |
| 5 | COMPLETED | Todos os casos passaram |
| 6 | ERROR | Erro de compilação/execução |
| 7 | SUBMITTED | Não-compilável, aguardando correção manual |
| 8 | PLAGIARISM | Marcado como plágio |
| 9 | SERVER_ERROR | Falha interna do engine |

(`PROCESSING` é o estado transitório usado pelo claim do engine entre `IN_QUEUE` e `COMPILING`.)
