---
title: Logs e auditoria
sidebar_position: 3
---

# Logs e auditoria

## Trilha de auditoria (`audit_log`)

Toda requisição ao `runcodes-api` (exceto `/api/health`) gera uma linha em `audit_log`, gravada por um middleware global (`http/middleware/auditLog.ts`) **depois** da resposta ser enviada, com ator, tipo, "ver como", método, rota normalizada (`/:id`, `/:email`), status, duração, IP (IPv6 inteiro), user-agent, `request_id` e corpo redigido (`password|token|secret|authorization|senha`) e truncado a 4000 caracteres. Login, reset de senha e console SQL gravam só os nomes dos campos. Detalhes de design em [admin-and-support](../backend/admin-and-support.md#log-de-auditoria-escrita).

Retenção: 180 dias, apagados pelo worker de plágio uma vez por dia.

## Consultando

- **Pela UI**: painel admin → **Auditoria** (`/admin/auditoria`). Resumo do período (24 h a 90 dias: requisições, erros, duração média, atores, por dia, top ações, top usuários; clicar numa ação ou num usuário aplica o filtro) e feed com filtros por ator, método, status, rota, período e texto livre (rota, IP, request id, user-agent). "Carregar mais" com contador "N de total"; expandir a linha mostra caminho, IP, request id e corpo redigido.
- **Pela API**: `GET /api/admin/audit/feed` e `GET /api/admin/audit/stats` (admin).
- **Direto no banco** (investigações): tabela `audit_log`, índices por `at`, `actor_email` e `route`.
- **Legado**: a tabela `logs` ("METHOD url -> status") continua legível em painel admin → **Logs (legado)** e `GET /api/admin/logs`, sem receber linhas novas.

Um `X-Request-Id` devolvido ao usuário num erro localiza a linha exata: filtre o texto livre por ele.

O que procurar em investigações comuns:

| Pergunta | Rastro |
|---|---|
| Quem alterou a nota desse aluno? | rota `PUT /api/commits/:id/score`, corpo com `score` |
| Quem recompilou o exercício? | `POST /api/exercises/:id/commits/recompile-all` |
| Quem baniu/desmatriculou? | `POST .../members/:email/ban` / `DELETE .../members/:email` (o e-mail real fica em `path`) |
| Quem publicou o aviso? | `POST /api/alerts` |
| Quem olhou a lista de usuários? | `GET /api/admin/users` com `actor_email` |
| Quem rodou SQL no console? | `POST /api/admin/db/query` (só os nomes dos campos até a F5) |

## Atividade global da plataforma

`GET /api/admin/stats/activity` (painel admin) — volume de submissões da plataforma inteira: hoje, ontem, últimos 7 dias e tendência de 28 dias. Agregado em memória a partir dos commits dos últimos 28 dias — adequado ao volume atual; se a escala crescer, mover a agregação pro SQL.

## Logs de infraestrutura

- **runcodes-compiler**: logs do processo (uma linha por fase do pipeline, com id do commit). É o primeiro lugar pra olhar quando submissões param de ser processadas — ver [Troubleshooting](../troubleshooting.md).
- **runcodes-api**: logs HTTP do Express + erros tipados (o `errorHandler` central mapeia erro de domínio → status).
- **server (legado)**: logs CakePHP (`app/tmp/logs`) e notificações Slack em inconsistência commit↔S3 (`Log::slackNotification`).
- **Email**: tabela `mail_logs` registra envios; `blacklist_mails` é legado (o broadcast novo deliberadamente não usa blacklist nem pixel de rastreio).
