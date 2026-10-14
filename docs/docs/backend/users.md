---
title: Users (signup)
sidebar_position: 2.5
---

# Users — cadastro e confirmação de email

Cobre cadastro, confirmação, recuperação de senha e perfil do próprio usuário (ver abaixo). Admin gerenciando conta de terceiros (CRUD completo, incluindo criar já confirmado e apagar) está em [admin-and-support.md](./admin-and-support.md).

## `POST /api/users` — signup

```json
// request
{ "email": "aluno@usp.br", "name": "Fulano", "password": "pelomenos8caracteres", "universityId": 1 }

// 201
{ "email": "aluno@usp.br" }
```

Cria o usuário com `type = 0` (aluno — promoção é ação de admin, nunca de signup), `confirmed = false`. Gera um token de confirmação aleatório (32 bytes) e guarda só o **hash sha256** dele, com expiração de 24h. O token é entregue por email (link `{APP_BASE_URL}/confirm?email=...&token=...`) via `EmailSender` — nunca aparece na resposta HTTP.

`POST /api/users/resend-confirmation` (`{ "email": "..." }` → `{ "sent": true }`) reenvia com um token novo, mesmo que o anterior já tenha expirado.

## Envio de email

`EmailSender` (interface em `repositories/email-sender.ts`) é o mesmo padrão de repository de tudo mais no projeto: `UserService` conhece só a interface, nunca o nodemailer. A implementação concreta (`SmtpEmailSender`) manda via SMTP, configurado por `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_FROM`. No `local-dev`, aponta pro `smtp4dev` (porta 2525) — a UI em `localhost:8081` mostra tudo que foi "enviado", e os testes de integração usam a API REST do smtp4dev pra pegar o email real e extrair o token, em vez de mockar o envio.

## Recuperação de senha

```
POST /api/users/request-password-reset  { "email": "..." }      → { "sent": true }
POST /api/users/reset-password          { "email", "token", "newPassword" } → { "reset": true }
```

Token aleatório, hash sha256 guardado, expira em 1h, entregue por email (link `{APP_BASE_URL}/reset-password?...`). Diferente do legado: o `UsersController::recoveryPassword()` do CakePHP gera uma senha nova no servidor e manda ela **em texto puro** por email. Aqui o email só carrega um token — a senha nova é escolhida pelo próprio usuário depois, nunca passa pelo corpo do email, então um email interceptado não expõe a senha.

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

## Perfil do próprio usuário

Mirrors `UsersController::profile()`. Era o item de maior impacto prático da [auditoria de paridade de out/2026](../roadmap/gap-audit-2026-10.md) — sem isso, ninguém trocava a própria senha pós-cadastro. Fechado na [Fase 10](../frontend/roadmap.md#fase-10--gestão-de-turma-avançada-).

```
GET /api/users/me                               (perfil sem o hash de senha)
PUT /api/users/me        { name?, universityId?, identifier? }
PUT /api/users/me/password  { oldPassword, newPassword }
```

`type`/`confirmed` nunca são patcháveis aqui — isso é admin-only ([admin-and-support.md](./admin-and-support.md)), separação deliberada igual a `OfferingMembershipService`/`EnrollmentService`: mesmo agregado, atores e regras de autorização diferentes.

Trocar senha verifica a senha atual do mesmo jeito que `AuthService.login()` — incluindo a migração transparente de hash sha1 legado pra bcrypt na primeira verificação bem-sucedida, então um usuário cujo hash ainda não migrou (nunca logou desde a migração) consegue trocar a senha normalmente. Senha atual errada → `401 invalid_current_password`.
