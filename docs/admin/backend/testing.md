---
title: Testes
sidebar_position: 6
---

# Testes

Dois níveis, propositalmente separados — configs e comandos diferentes:

## Unitário — `npm test`

`vitest.config.ts`. 230 testes, todos os services (mais o middleware de auditoria), **zero banco/rede** — cada teste instancia o service passando repositórios mockados (`vi.fn()` implementando a interface do repositório, não o Prisma). Roda em cerca de 1 segundo, pode rodar em qualquer CI sem infra.

Cobertura: toda regra de negócio de cada service (auth, user/signup, enrollment, offering membership, course, offering, exercise, exercise management, exercise attachment, exercise case, commit, commit case result, plagiarism, plagiarism worker, university, allowed-file, admin user, grades, ticket, alert, question, public-exercise, log) — ver código-fonte em `src/services/*.test.ts`, cada arquivo ao lado do service que testa.

## Integração — `npm run test:integration`

`vitest.integration.config.ts`. Exercita o stack real: Postgres real (via `PrismaClient` de verdade), S3/SeaweedFS real, roteamento Express real via `supertest`, **o `runcodes-compiler` Python real** rodando no `local-dev`, e **Dolos/JPlag reais** (não mockados) via um worker BullMQ iniciado in-process no `beforeAll` do próprio teste — não depende de `npm run start:worker` rodando à parte.

Requer:

```bash
# na pasta local-dev
docker compose -f docker-compose.local.yml up -d
```

Cada execução cria seus próprios fixtures (course/offering/exercise/usuários com sufixo de timestamp) e limpa tudo em `afterAll` — não depende do seed do `local-dev` nem o modifica. 61 testes, incluindo o fluxo completo: login real, controle de acesso antes/depois de matrícula, rejeição de tipo de arquivo, submissão real sendo pega e corrigida pelo engine Python (poll até status sair de `IN_QUEUE`, tipicamente ~1-8s), signup/confirmação/reenvio/reset de senha com email real entregue via `smtp4dev` (extrai o token pela API REST dele, em vez de mockar), gestão de turma, CRUD de exercício/caso com round-trip real no S3, detecção de plágio rodando Dolos e JPlag de verdade sobre submissões reais, upload de arquivo + compartilhamento ghost entre turmas (achou um bug real de redirecionamento nesse último), os dashboards de professor (export CSV de notas, stats, zip de submissões — esse último precisou de um parser binário customizado no supertest, já que o superagent não bufferiza `application/zip` por padrão), o log de auditoria (uma mutação real gera uma linha correspondente em `GET /api/admin/logs`; um `GET` não gera nenhuma), e `ExerciseCaseFile` (upload/download/delete de arquivo de caso de teste, round-trip real pela chave exata que o `runcodes-compiler` lê, e confirmando que apagar o caso limpa os arquivos órfãos no S3).

Pegadinha encontrada no caminho: o helper que busca o email no `smtp4dev` não pode simplesmente pegar "a mensagem mais recente pra esse endereço" — uma conta pode ter um email antigo nunca consumido (ex. a confirmação do signup inicial) ainda sentado na caixa quando um passo posterior (reenvio, reset) dispara um novo. O helper filtra por mensagens recebidas depois de um timestamp `since` capturado antes da requisição que disparou o envio, não só "a mais nova que existir".

## Por que essa separação

Testes unitários validam a **lógica de negócio isolada** — rápidos, deterministicos, sempre rodam. Testes de integração validam que as **peças realmente se encaixam** (mapeamento Prisma correto, contrato S3 com o engine, códigos HTTP reais) — mais lentos, precisam de infra, não deveriam travar todo PR se a infra estiver fora do ar, mas são indispensáveis antes de qualquer deploy porque é a única forma de pegar quebra de contrato entre `runcodes-api` e o `runcodes-compiler`.
