---
title: Detecção de plágio (MOSS, JPlag, Dolos)
sidebar_position: 2
---

# Detecção de plágio

:::info Status
**Dolos e JPlag implementados e verificados contra as ferramentas reais** (não mock) — ver [resultado abaixo](#verificação). MOSS segue fora de escopo, por design: depende de serviço externo da Stanford, sem self-hosting.
:::

## Por que as três ferramentas são fundamentalmente diferentes

| | MOSS | JPlag | Dolos |
|---|---|---|---|
| Execução | Serviço externo (Stanford) | Processo local (JVM) | Processo local (Node/TS) |
| Protocolo | Socket TCP próprio + script Perl (`moss.pl`) | CLI (jar) | CLI (`@dodona/dolos`) |
| Self-hosted? | Não — depende do servidor da Stanford | Sim | Sim |
| Resultado | URL de relatório HTML (gerado no servidor deles) | CSV (`--csv-export`) | CSV (`-f csv`) |
| Latência | Minutos (fila do lado deles, fora do nosso controle) | ~1-2s pra turmas pequenas (CPU-bound local) | ~1-2s pra turmas pequenas (CPU-bound local) |
| Runtime necessário | Nenhum binário nosso — upload via socket | Java (JVM) | Node (já é o runtime do `runcodes-api`) |

Nenhuma das três devolve resultado na mesma chamada — por isso a arquitetura é job assíncrono em fila, não request/response.

## Arquitetura implementada

Mesmo padrão repository do resto do backend ([ver arquitetura](../backend/overview.md#arquitetura-em-camadas)):

```ts
interface PlagiarismProvider {
  readonly name: "dolos" | "jplag";
  compare(submissions: SubmissionFile[]): Promise<PlagiarismComparisonResult>;
}
```

- **`DolosProvider`** / **`JPlagProvider`** (`src/repositories/*-provider.ts`): cada um escreve as submissões num diretório temporário, dá `execFile` na CLI (`npx @dodona/dolos` / `java -jar vendor/jplag/jplag.jar`), parseia o CSV de saída, normaliza pra `{ studentA, studentB, similarity }`, limpa o diretório temporário.
- **`plagiarism_runs`** (tabela nova, migration 003): `id, exercise_id, provider, status (queued/running/completed/failed), requested_by, result jsonb, error, created_at, completed_at`.
- **`PlagiarismJobQueue`** (interface) + **`BullMqPlagiarismJobQueue`** (implementação, Redis — já existe no `local-dev`, só precisou expor a porta 6379 pro host). O service nunca importa BullMQ diretamente, mesma decisão de desacoplamento usada em todo o resto.
- **Worker separado** (`src/worker.ts`, `npm run start:worker`) — processo próprio, **não** roda dentro da API. Mesma razão do `runcodes-compiler` ser isolado: JPlag precisa de JVM no host, as duas ferramentas podem rodar minutos numa turma grande, e nenhuma das duas deveria travar — nem ser dependência de deploy — da API HTTP.

### API

```
POST /api/exercises/:id/plagiarism-runs   { provider: "dolos" | "jplag" }   (staff/admin) → 202 + run (status=queued)
GET  /api/exercises/:id/plagiarism-runs                                     (staff/admin)
GET  /api/plagiarism-runs/:id                                               (staff/admin) → polling até status sair de queued/running
```

Dataset comparado: o commit mais recente de cada aluno matriculado no exercício (`CommitRepository.listLatestPerStudentForExercise`), baixado do mesmo bucket S3 `runcodes-commits` que a submissão já usa.

## Verificação

Testado com dados reais, não mock — 3 alunos, 2 soluções idênticas + 1 não relacionada, mesmo exercício Python:

```json
[
  { "studentA": "alice", "studentB": "bob",   "similarity": 1.0  },
  { "studentA": "alice", "studentB": "carol", "similarity": 0.08 },
  { "studentA": "bob",   "studentB": "carol", "similarity": 0.08 }
]
```

Prova que a ferramenta discrimina de verdade (não devolve 1.0 pra qualquer par) — resultado idêntico no Dolos e no JPlag. Testes de integração automatizam exatamente esse cenário ([testing.md](../backend/testing.md)), com um worker BullMQ rodando in-process durante o teste (sem depender de `npm run start:worker` rodando à parte).

### Bug real encontrado no processo

JPlag tem `--min-tokens` default = 12. Qualquer exercício curto (ex. `print("hello")`) fica abaixo disso e o JPlag **aborta a corrida inteira** (`Not enough valid submissions!`) em vez de só pontuar baixo. Ajustado pra `-t 1` — deixa o próprio score de similaridade discriminar, em vez de um corte rígido de tokens que mata exercícios triviais (que são a maioria num curso introdutório).

## Riscos conhecidos

- **JPlag exige JVM no host** do worker — por isso processo separado (`src/worker.ts`), nunca empacotado dentro do deploy da API.
- **Volume de dados**: comparar todos os pares de alunos é O(n²) — turmas grandes podem levar minutos. A API já reflete isso (fila assíncrona), a UI que consumir precisa assumir polling de longo prazo.
- **Falsos positivos em exercícios triviais**: mesmo com `-t 1`, exercícios tipo "Hello World" têm poucas formas diferentes de serem escritos — similaridade alta não é prova de cópia. Resultado deve ser tratado como "sinal para revisão humana", nunca veredito automático.

## MOSS — segue fora de escopo

Depende de infraestrutura de terceiro (servidor Stanford), protocolo de socket não documentado oficialmente, `userid` registrado por email por instalação. Nenhuma dessas três coisas combina com o resto da arquitetura (self-hosted, sem dependência de rede externa pra funcionar). O legado (`similarity-checker` em `server`) já integra com MOSS — se for preciso preservar continuidade de relatórios antigos, isso é o único motivo pra revisitar essa decisão.
