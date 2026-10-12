---
title: Estratégia de migração
sidebar_position: 2
---

# Por que Node.js/React, e como migrar sem reescrever tudo

## Contexto

O `server` legado é CakePHP 2.4 rodando em PHP 5.6 (EOL desde 2018). Reescrever do zero ("big-bang") foi descartado: alto risco, sem entrega contínua, e o sistema atende usuários reais (ICMC/USP) o tempo todo.

## Decisão: strangler pattern

- **Backend**: `runcodes-api` (Node/TS) sobe ao lado do `server` (PHP). Um proxy (Caddy/nginx) roteia por path — rotas migradas vão para o Node, o resto continua no PHP, até o PHP não ter mais rotas.
- **Frontend**: `runcodes-web` (React) é construído do zero consumindo a API nova desde o início — não espera o backend terminar.
- **compiler-engine/compiler-monitor**: **não migram**. Já são um serviço isolado, crítico para segurança (sandbox), escrito em Python com testes e hardening recentes. A única interface com eles é a tabela `commits` + bucket S3 — ver [fluxo de submissão](./overview.md#fluxo-de-uma-submissão-commit). Reescrever em Node não teria justificativa técnica.
- **Banco de dados**: schema Postgres existente, sem migração de dados. `runcodes-api` usa Prisma via introspecção (`prisma db pull`) — não redesenha o schema, só mapeia o que já existe.

## Por que React (e não Vue/Angular)

Critério: maior ecossistema para o que esse produto precisa — editor de código embutido (Monaco/CodeMirror), grids de dados (submissões, notas), maior pool de desenvolvedores disponíveis. Vue é viável mas ecossistema menor nesse nicho; Angular é estruturalmente mais rígido do que o time precisa.

## Por que repos separados (`runcodes-api`, `runcodes-web`, `runcodes-docs`)

Mesmo padrão já usado no projeto (`server`, `database`, `compiler-engine`, `compiler-monitor`, `deploy` já são repos próprios): cada módulo tem ciclo de vida, deploy e dependências independentes. Acoplar backend e frontend novos no mesmo repo do PHP legado criaria uma dependência de deploy artificial entre peças que não precisam compartilhar nada além do contrato HTTP/schema de banco.

## Ordem de migração de módulos

1. ✅ Auth (login, JWT, migração transparente de senha)
2. ✅ Courses / Offerings / Exercises (leitura)
3. ✅ Enrollments (entrar em turma por código)
4. ✅ Commits (submissão de código — o caminho crítico: sem isso a API não serve pra nada)
5. ✅ Cadastro de usuário (signup, confirmação de email — reset de senha ainda falta)
6. ✅ Gestão de turma (promover/rebaixar professor/assistente, banir aluno — notas/CSV ainda faltam)
7. 🔜 CRUD de exercícios e casos de teste
8. 🔜 Detecção de plágio (ver [roadmap](../roadmap/plagiarism-detection.md))
9. Backlog: tickets, mensagens, alerts, emails transacionais, reset de senha, questions, admin de universidades

Status detalhado por módulo: [backend overview](../backend/overview.md).
