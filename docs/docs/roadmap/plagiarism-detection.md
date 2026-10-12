---
title: Detecção de plágio (MOSS, JPlag, Dolos)
sidebar_position: 2
---

# Detecção de plágio

:::info Status
Documento de **arquitetura/design**. Nenhuma das três integrações está implementada ainda — este é o plano antes de escrever código, para que a primeira implementação (Dolos) já nasça na forma certa para plugar as outras duas depois.
:::

## Por que as três ferramentas são fundamentalmente diferentes

| | MOSS | JPlag | Dolos |
|---|---|---|---|
| Execução | Serviço externo (Stanford) | Processo local (JVM) | Processo local (Node/TS) |
| Protocolo | Socket TCP próprio + script Perl (`moss.pl`) | CLI/biblioteca Java | CLI/biblioteca TypeScript |
| Self-hosted? | Não — depende do servidor da Stanford | Sim | Sim |
| Autenticação | `userid` registrado por email | N/A | N/A |
| Resultado | URL de relatório HTML (gerado no servidor deles) | Arquivo (zip) com JSON + viewer embutido | JSON/CSV + dashboard web |
| Latência | Minutos (fila do lado deles, fora do nosso controle) | Segundos a minutos (CPU-bound local) | Segundos a minutos (CPU-bound local) |
| Runtime necessário | Nenhum binário nosso — upload via socket | Java (JRE) | Já é Node — roda no mesmo runtime do `runcodes-api` |

Essa tabela é a razão de **não** desenhar uma integração request/response síncrona: nenhuma das três devolve resultado na mesma chamada. É um job assíncrono em todos os casos, variando só o grau de "externo" vs "local".

## Arquitetura: `PlagiarismProvider` + fila de jobs

Mesmo padrão repository já usado no resto do backend ([ver arquitetura](../backend/overview.md#arquitetura-em-camadas)), adaptado para execução assíncrona:

```ts
interface PlagiarismProvider {
  readonly name: "moss" | "jplag" | "dolos";
  submit(job: PlagiarismJobInput): Promise<ProviderRunRef>; // opaco: URL, job id, path...
  fetchResult(ref: ProviderRunRef): Promise<PlagiarismResult | "pending" | "failed">;
}
```

- `PlagiarismJobInput`: id do exercício, lista de `(commit_id, user_email, file_content)` — tipicamente o último commit de cada aluno na turma.
- Cada provider concreto (`MossProvider`, `JPlagProvider`, `DolosProvider`) implementa esse contrato do seu jeito — MOSS fala socket com Stanford, JPlag faz `spawn()` do jar, Dolos roda a lib TS direto ou via `spawn()` do CLI.
- Uma tabela nova `plagiarism_runs` (id, exercise_id, provider, status, provider_run_ref, result_summary jsonb, requested_by, created_at, completed_at) guarda o estado — o mesmo padrão polling que o `compiler-engine` já usa pra `commits`, reaproveitado.
- Um worker (processo separado ou fila com Redis — **já existe `redis` no `local-dev`**, usar BullMQ em vez de inventar um poller do zero) processa `plagiarism_runs` com `status = queued`, chama `provider.submit()`, e depois faz polling periódico via `provider.fetchResult()` até sair de `pending`.

### Superfície de API prevista

```
POST /api/exercises/:id/plagiarism-runs   { provider: "dolos" | "jplag" | "moss" }   (staff/admin)
GET  /api/exercises/:id/plagiarism-runs                                              (staff/admin)
GET  /api/plagiarism-runs/:id                                                        (staff/admin)
```

Resultado armazenado como `result_summary` normalizado (pares de alunos + score de similaridade 0-1), independente de qual provider gerou — o relatório bruto de cada ferramenta (zip do JPlag, URL do MOSS, JSON do Dolos) fica referenciado mas não é o formato de consumo da UI.

## Ordem de implementação recomendada

1. **Dolos primeiro.** É TypeScript-nativo — roda no mesmo runtime do `runcodes-api`, sem JVM, sem dependência de terceiro externo, sem protocolo de socket pra reimplementar. Menor risco, maior velocidade de entrega, e valida a interface `PlagiarismProvider` com uma implementação real antes de generalizar.
2. **JPlag segundo.** Mesma categoria de risco do `compiler-engine` (já lidamos com spawnar processo externo + parsear saída) — `spawn()` do CLI jar, parsear o zip de resultado. Requer Java disponível no ambiente de execução (imagem Docker própria, como `compiler-images` já faz por linguagem).
3. **MOSS por último.** Depende de infraestrutura de terceiro (servidor Stanford) fora do nosso controle — latência variável, protocolo não documentado oficialmente (reverse-engineered pela comunidade), requer `userid` registrado por email para cada instalação. Prioridade mais baixa porque é a única opção que não escala/não é self-hosted; mantida no plano porque o legado (`similarity-checker` em `server`) já integra com ela e pode haver continuidade de histórico de relatórios a preservar.

## Riscos conhecidos

- **JPlag/MOSS exigem runtime externo** (JVM / rede pra Stanford) — o worker de plágio não pode rodar no mesmo processo do `runcodes-api` sem acoplar esses requisitos ao deploy da API. Recomenda-se processo/serviço separado (mesmo padrão do `compiler-engine` sendo um serviço isolado), não um módulo dentro do monólito Express.
- **Volume de dados**: comparar todos os pares de alunos de uma turma grande é O(n²) nas três ferramentas — jobs podem demorar minutos. A UI precisa assumir polling de longo prazo, não espera síncrona.
- **Falsos positivos em exercícios "Hello World"-like**: qualquer ferramenta de similaridade de código acerta demais em exercícios triviais onde a solução canônica é quase única. Resultado deve ser apresentado como "sinal para revisão humana", nunca como veredito automático — isso é uma decisão de produto, não só técnica.
