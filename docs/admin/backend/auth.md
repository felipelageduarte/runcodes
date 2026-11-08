---
title: Auth
sidebar_position: 2
---

# Autenticação

## `POST /api/auth/login`

```json
// request
{ "email": "aluno@usp.br", "password": "..." }

// 200
{ "token": "eyJ...", "user": { "email": "...", "name": "...", "type": 0 } }

// 401
{ "error": "invalid_credentials" }
```

Token JWT (`Authorization: Bearer <token>` ou cookie httpOnly `token`), payload `{ sub: email, type, tv, realType? }`. Expira em `JWT_EXPIRES_IN` (default **1 h**); o cookie de sessão dura 7 dias e é renovado por `POST /api/auth/refresh` (abaixo).

## Sessão revogável (F2 da spec admin-e-separacao-front)

O token prova identidade; **papel e estado da conta vêm do banco a cada request**. `requireAuth` (`src/http/middleware/requireAuth.ts`):

1. Verifica a assinatura e a expiração (`401 token_expired` quando venceu: o cliente tenta o refresh).
2. Relê `type`, `confirmed` e `token_version` do usuário (`SessionStateCache`, `src/lib/session-state.ts`: cache em memória de 60 s por e-mail, invalidado por quem escreve).
3. Compara a claim `tv` com `users.token_version`: diferente → `401 session_revoked`. Token sem `tv` (emitido antes da F2) vale como `tv = 0`.
4. Conta não confirmada → `401 account_not_confirmed`; usuário apagado → `401 invalid_token`.
5. `req.user.type` é o do banco. Em view-as, o papel efetivo é o do token, limitado pelo papel real atual (`realType` relido); se a conta foi rebaixada até o papel visto, o view-as some.

**O que incrementa `token_version`** (`SessionRevocation.revoke`, chamado pelos services, nunca pela rota): trocar a senha (`PUT /api/users/me/password`), redefinir por e-mail, e o admin mudar `type` ou `confirmed` (`PUT /api/admin/users/:email`). Confirmar a conta e excluir só invalidam o cache (`refresh`). A rehash transparente sha1 → bcrypt no login **não** incrementa.

Garantia: rebaixar um admin derruba a sessão dele imediatamente no mesmo processo e em até 60 s se a escrita vier de fora (SQL à mão). Testes: `requireAuth.test.ts` e o bloco "sessão revogável" em `full-flow.integration.test.ts`.

### `POST /api/auth/refresh`

Troca o token atual (cookie ou Bearer) por um novo, **sem senha**, mesmo que já expirado, desde que a expiração tenha menos de 7 dias (`REFRESH_WINDOW_MS`). Relê o usuário, recusa `tv` divergente (`401 session_revoked`), conta desconfirmada e token fora da janela (`401 session_expired`); preserva o view-as. Não passa pelo `requireAuth` de propósito. O `apiFetch` do web chama isto uma vez ao receber 401 (exceto em login/logout/refresh) e repete a chamada original; renovação concorrente é compartilhada.

Migration: `api/db/migrations/008_add_users_token_version.sql` (aditiva, default 0).

### Anti-CSRF (`src/http/middleware/csrfGuard.ts`)

Só para mutações (`POST/PUT/PATCH/DELETE`) **autenticadas pelo cookie**; Bearer sem cookie passa direto. Exige `Origin` (ou `Referer`) dentro de `APP_BASE_URL` + `APP_ALLOWED_ORIGINS` (`403 csrf_origin_missing` / `csrf_origin_mismatch`) e `X-Requested-With: runcodes-web` (`403 csrf_header_missing`). Montado antes do `auditLog`, então request forjado não vira linha de auditoria.

`CSRF_REQUIRE_HEADER` (default `false`): durante a transição em que o front em produção ainda não manda o cabeçalho (F0), só a checagem de `Origin` vale. Ligar (`true`) assim que a F0 estiver na `main`; depois, remover a flag e deixar a exigência fixa.

## Tipos de usuário

Espelha `User::get*Index()` do CakePHP (`src/lib/constants.ts`):

| Valor | Papel |
|---|---|
| 0 | Aluno |
| 1 | Monitor/assistente |
| 2 | Professor |
| 3 | Admin |
| 4 | Developer |

## Migração de senha sha1 → bcrypt

O CakePHP 2.x usa `AuthComponent::password()` = `sha1(Security.salt + senha)`, armazenado em `varchar(40)`. `AuthService.login()`:

1. Se o hash armazenado tem 40 caracteres (`isLegacyHash`), verifica contra `sha1(salt + senha)`.
2. Senão, verifica com `bcrypt.compare`.
3. **Se a verificação legada passou**, reescreve o hash para bcrypt (`updatePassword`) — transparente, sem pedir nova senha ao usuário.

Isso é testado em `auth.service.test.ts` com os 4 casos (hash legado certo/errado, hash bcrypt certo/errado) — sem precisar de banco, mockando `UserRepository`.

:::warning Caminho sem volta
Depois da rehash, a senha vira bcrypt — o `server` (CakePHP) legado **não consegue mais validar aquele usuário**, porque ele só sabe comparar sha1 direto. Isso é intencional: força a migração de login por usuário, mas significa que login pelo PHP legado some silenciosamente após o primeiro login bem-sucedido pela API nova. Veja [roadmap](../roadmap/backlog.md) — manter os dois logins funcionando em paralelo indefinidamente não é objetivo.
:::

A migração requer `database/migrations/001_widen_users_password.sql` (coluna `password` de `varchar(40)` para `varchar(255)` — bcrypt gera 60 caracteres).
