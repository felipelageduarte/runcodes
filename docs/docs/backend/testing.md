---
title: Testes
sidebar_position: 6
---

# Testes

Dois níveis, propositalmente separados — configs e comandos diferentes:

## Unitário — `npm test`

`vitest.config.ts`. 109 testes, todos os services, **zero banco/rede** — cada teste instancia o service passando repositórios mockados (`vi.fn()` implementando a interface do repositório, não o Prisma). Roda em menos de 1 segundo, pode rodar em qualquer CI sem infra.

Cobertura: toda regra de negócio de cada service (auth, user/signup, enrollment, offering membership, course, offering, exercise, exercise management, exercise case, commit, plagiarism, plagiarism worker) — ver código-fonte em `src/services/*.test.ts`, cada arquivo ao lado do service que testa.

## Integração — `npm run test:integration`

`vitest.integration.config.ts`. Exercita o stack real: Postgres real (via `PrismaClient` de verdade), S3/SeaweedFS real, roteamento Express real via `supertest`, **o `compiler-engine` Python real** rodando no `local-dev`, e **Dolos/JPlag reais** (não mockados) via um worker BullMQ iniciado in-process no `beforeAll` do próprio teste — não depende de `npm run start:worker` rodando à parte.

Requer:

```bash
# na pasta local-dev
docker compose -f docker-compose.local.yml up -d
```

Cada execução cria seus próprios fixtures (course/offering/exercise/usuários com sufixo de timestamp) e limpa tudo em `afterAll` — não depende do seed do `local-dev` nem o modifica. 37 testes, incluindo o fluxo completo: login real, controle de acesso antes/depois de matrícula, rejeição de tipo de arquivo, submissão real sendo pega e corrigida pelo engine Python (poll até status sair de `IN_QUEUE`, tipicamente ~1-8s), signup/confirmação, gestão de turma, CRUD de exercício/caso com round-trip real no S3, e detecção de plágio rodando Dolos e JPlag de verdade sobre submissões reais.

## Por que essa separação

Testes unitários validam a **lógica de negócio isolada** — rápidos, deterministicos, sempre rodam. Testes de integração validam que as **peças realmente se encaixam** (mapeamento Prisma correto, contrato S3 com o engine, códigos HTTP reais) — mais lentos, precisam de infra, não deveriam travar todo PR se a infra estiver fora do ar, mas são indispensáveis antes de qualquer deploy porque é a única forma de pegar quebra de contrato entre `runcodes-api` e o `compiler-engine`.
