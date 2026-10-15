---
id: index
title: Documentação de administração e técnica
slug: /
sidebar_position: 1
---

# run.codes — administração e documentação técnica

Esta seção documenta o **sistema por dentro**: arquitetura, operação, gestão da plataforma e os documentos de design dos módulos. É o material do administrador e de quem desenvolve/opera o run.codes — o manual de uso da plataforma (aluno/professor) é a [outra seção desta documentação](/manual/intro).

## Os repositórios

O sistema é um monorepo *lógico* (mesma organização, propósito único) mas **poliglota e multi-repo** na prática — cada módulo tem seu próprio ciclo de vida, linguagem e deploy:

| Repositório | Linguagem | Responsabilidade |
|---|---|---|
| [`server`](https://github.com/runcodes-icmc/server) | PHP 5.6 / CakePHP 2.4 | Aplicação web legada (em migração) |
| [`runcodes-api`](https://github.com/runcodes-icmc/runcodes-api) | Node.js / TypeScript | Nova API — substitui `server` incrementalmente |
| [`runcodes-web`](https://github.com/runcodes-icmc/runcodes-web) | React / TypeScript | Novo frontend — substitui as views do `server` |
| `runcodes-compiler` | Python | Motor de compilação/execução sandboxed (`rcc`) |
| `runcodes-compiler-sandbox` | C | Processo dentro do container que mede tempo/memória/sinais |
| `runcodes-compiler-images` | Dockerfiles | Imagens de compilação por linguagem |
| `database` | SQL | Schema Postgres compartilhado por todos os módulos |
| `deploy` | Ansible | Deploy de produção |
| `local-dev` | Docker Compose | Ambiente de desenvolvimento local integrado |

Nenhum desses repos sozinho pode documentar "como o sistema funciona" — só a junção faz sentido. Daí o repo `runcodes-docs` à parte.

## Mapa de leitura

### Arquitetura

- **[Visão geral](./architecture/overview.md)** — como as peças se conectam, o fluxo de uma submissão ponta a ponta.
- **[Componentes do sistema](./architecture/componentes.md)** — o papel e a estrutura interna de cada repositório (engine, monitor, imagens, banco, deploy).
- **[Contratos entre módulos](./architecture/contratos.md)** — o que não pode mudar sem revisar o vizinho: protocolo de mensagens, chaves S3, schema.
- **[Estratégia de migração](./architecture/migration-strategy.md)** — por que Node.js/React, e como a migração do PHP legado está sendo feita (strangler pattern).

### Operação

- **[Pipeline de correção](./operacao/pipeline.md)** — como o `runcodes-compiler` processa submissões, concorrência, variáveis de ambiente, recompilação, como adicionar uma linguagem.
- **[Banco de dados](./operacao/banco-de-dados.md)** — tabelas principais, variantes de schema, regra de ouro pra mudanças.
- **[Logs e auditoria](./operacao/logs-e-auditoria.md)** — o log de auditoria de mutações e o painel de atividade.
- **[Deploy](./operacao/deploy.md)** — playbooks Ansible e o que cada um instala.
- **[Troubleshooting](./troubleshooting.md)** — diagnóstico dos problemas recorrentes (commit preso na fila, erro interno do engine, email não chega...).

### Gestão da plataforma

- **[Instituições e usuários](./gestao/instituicoes-e-usuarios.md)** — universidades, contas, broadcast de email, suporte.
- **[Tipos de arquivo e linguagens](./gestao/tipos-de-arquivo.md)** — o catálogo `allowed_files` e sua relação com as imagens de compilação.

### Documentos de design dos módulos novos

- **[Backend (`runcodes-api`)](./backend/overview.md)** — arquitetura em camadas, módulos implementados, testes. Funcionalmente completo.
- **[Frontend (`runcodes-web`)](./frontend/overview.md)** — SDD do frontend novo: arquitetura modular, design system, jornadas, editor de código, marketplace, segurança, testes.
- **[Roadmap](./roadmap/backlog.md)** — histórico de gaps e decisões, incluindo a [auditoria de paridade de out/2026](./roadmap/gap-audit-2026-10.md) e a [detecção de plágio](./roadmap/plagiarism-detection.md).
