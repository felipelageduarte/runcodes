---
title: Users (signup)
sidebar_position: 2.5
---

# Users — cadastro e confirmação de email

Hoje só cobre o que faltava pra alguém conseguir entrar no sistema pela primeira vez. CRUD de usuário por admin, perfil, recuperação de senha seguem no [backlog](../roadmap/backlog.md).

## `POST /api/users` — signup

```json
// request
{ "email": "aluno@usp.br", "name": "Fulano", "password": "pelomenos8caracteres", "universityId": 1 }

// 201
{ "email": "aluno@usp.br", "confirmationToken": "a3f9..." }
```

Cria o usuário com `type = 0` (aluno — promoção é ação de admin, nunca de signup), `confirmed = false`. Gera um token de confirmação aleatório (32 bytes) e guarda só o **hash sha256** dele, com expiração de 24h.

:::warning Sem serviço de email ainda
Não existe módulo de envio de email no `runcodes-api` ainda ([backlog](../roadmap/backlog.md)). Por isso a rota devolve o `confirmationToken` bruto na resposta — é temporário, até existir um serviço de email que consuma esse token e mande o link por email em vez de devolvê-lo na API.
:::

### Por que não é igual ao CakePHP legado

O legado usa `sha1(salt + email)` como link de confirmação: **determinístico e sem expiração** — qualquer um que descubra o salt consegue recalcular o link de confirmação de qualquer usuário, pra sempre. A versão nova gera um token aleatório por cadastro, nunca reaproveitável, expira em 24h. Isso é exatamente o tipo de coisa que esse projeto [decidiu não clonar do legado](../roadmap/backlog.md#fora-de-escopo-deliberado).

## `POST /api/users/confirm`

```json
{ "email": "aluno@usp.br", "token": "a3f9..." }
```

Idempotente: confirmar uma conta já confirmada não dá erro. Token errado, expirado, ou inexistente → `422` com código específico (`invalid_confirmation_token`, `confirmation_token_expired`, `no_pending_confirmation`).

## Login bloqueado até confirmar

`AuthService.login()` rejeita login de conta não confirmada com `403 account_not_confirmed` — **depois** de validar a senha, não antes. Isso evita vazar "essa conta existe mas não está confirmada" pra quem não sabe a senha: senha errada sempre volta `401 invalid_credentials`, confirmação pendente só aparece pra quem já provou saber a senha certa.

Esse comportamento não existia até esse módulo ser implementado — a versão anterior do `AuthService` não checava `confirmed` nenhuma vez, então uma conta recém-cadastrada conseguiria logar na hora. Corrigido junto com o signup, testado (unitário e integração) nos dois estados.
