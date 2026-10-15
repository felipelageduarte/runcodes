---
title: Logs e auditoria
sidebar_position: 3
---

# Logs e auditoria

## Log de auditoria de mutações

Toda requisição **mutante** (`POST`/`PUT`/`PATCH`/`DELETE`) autenticada no `runcodes-api` gera uma linha na tabela `logs`, registrada por um middleware global (`http/middleware/auditLog.ts`) **depois** da resposta ser enviada — incluindo ações negadas (uma tentativa 403 também é relevante pra auditoria). Formato da mensagem: `"POST /api/enrollments -> 201"` (quem, o quê, quando, resultado).

Isso substitui as ~60 chamadas manuais a `Log::register()` espalhadas pelos controllers do legado: um ponto único cobre toda rota de mutação automaticamente, inclusive as criadas depois. O trade-off deliberado: a mensagem perde a prosa do legado ("Enrolled in the offering #5"), mantém os mesmos fatos. Contexto completo em [admin-and-support](../backend/admin-and-support.md#log-de-auditoria-escrita).

## Consultando

- **Pela UI**: painel admin → Logs (leitura, admin-only). Sem filtro por tipo de ação/intervalo ainda (paridade com o legado, que também não tinha).
- **Pela API**: `GET /api/admin/logs` (admin).
- **Direto no banco** (investigações): tabela `logs` — filtre por email do usuário e janela de tempo.

O que procurar em investigações comuns:

| Pergunta | Rastro |
|---|---|
| Quem alterou a nota desse aluno? | `PUT /api/commits/:id/score` no log, com o email do autor |
| Quem recompilou o exercício? | `POST /api/exercises/:id/commits/recompile-all` |
| Quem baniu/desmatriculou? | `POST .../members/:email/ban` / `DELETE .../members/:email` |
| Quem publicou o aviso? | `POST /api/alerts` |

## Atividade global da plataforma

`GET /api/admin/stats/activity` (painel admin) — volume de submissões da plataforma inteira: hoje, ontem, últimos 7 dias e tendência de 28 dias. Agregado em memória a partir dos commits dos últimos 28 dias — adequado ao volume atual; se a escala crescer, mover a agregação pro SQL.

## Logs de infraestrutura

- **runcodes-compiler**: logs do processo (uma linha por fase do pipeline, com id do commit). É o primeiro lugar pra olhar quando submissões param de ser processadas — ver [Troubleshooting](../troubleshooting.md).
- **runcodes-api**: logs HTTP do Express + erros tipados (o `errorHandler` central mapeia erro de domínio → status).
- **server (legado)**: logs CakePHP (`app/tmp/logs`) e notificações Slack em inconsistência commit↔S3 (`Log::slackNotification`).
- **Email**: tabela `mail_logs` registra envios; `blacklist_mails` é legado (o broadcast novo deliberadamente não usa blacklist nem pixel de rastreio).
