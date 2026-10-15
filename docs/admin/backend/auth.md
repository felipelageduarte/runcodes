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

Token JWT (`Authorization: Bearer <token>`), payload `{ sub: email, type }`. Expiração configurável via `JWT_EXPIRES_IN`.

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
