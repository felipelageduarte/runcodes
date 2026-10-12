---
id: intro
title: run.codes — visão geral
slug: /
sidebar_position: 1
---

# run.codes

run.codes é uma plataforma de correção automática de exercícios de programação (online judge) usada no ICMC/USP e outras instituições. Este site documenta o **sistema como um todo**: como os repositórios se encaixam, as decisões de arquitetura e o estado de cada módulo.

## Por que um repo de documentação separado

O sistema é um monorepo *lógico* (mesma organização, propósito único) mas **poliglota e multi-repo** na prática — cada módulo tem seu próprio ciclo de vida, linguagem e deploy:

| Repositório | Linguagem | Responsabilidade |
|---|---|---|
| [`server`](https://github.com/runcodes-icmc/server) | PHP 5.6 / CakePHP 2.4 | Aplicação web legada (em migração) |
| [`runcodes-api`](https://github.com/runcodes-icmc/runcodes-api) | Node.js / TypeScript | Nova API — substitui `server` incrementalmente |
| [`runcodes-web`](https://github.com/runcodes-icmc/runcodes-web) | React / TypeScript | Novo frontend — substitui as views do `server` |
| `compiler-engine` | Python | Motor de compilação/execução sandboxed (`rcc`) |
| `compiler-monitor` | C | Processo dentro do container que mede tempo/memória/sinais |
| `compiler-images` | Dockerfiles | Imagens de compilação por linguagem |
| `database` | SQL | Schema Postgres compartilhado por todos os módulos |
| `deploy` | IaC/scripts | Deploy de produção |
| `local-dev` | Docker Compose | Ambiente de desenvolvimento local integrado |

Nenhum desses repos sozinho pode documentar "como o sistema funciona" — só a junção faz sentido. Daí o repo `runcodes-docs` à parte.

## Mapa de leitura

- **[Arquitetura](./architecture/overview.md)** — como as peças se conectam, o fluxo de uma submissão de código ponta a ponta.
- **[Estratégia de migração](./architecture/migration-strategy.md)** — por que Node.js/React, e como a migração do PHP legado está sendo feita (strangler pattern).
- **[Backend (runcodes-api)](./backend/overview.md)** — arquitetura em camadas, módulos implementados, como testar.
- **[Roadmap](./roadmap/backlog.md)** — o que falta, incluindo o plano de detecção de plágio (MOSS/JPlag/Dolos).
