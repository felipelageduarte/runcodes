---
title: Deploy (Ansible)
sidebar_position: 4
---

# Deploy

O repo `deploy` concentra os playbooks e roles Ansible que provisionam e atualizam produção. É o único repositório puramente operacional.

## Playbooks

| Playbook | Role(s) | O que instala |
|---|---|---|
| `setup.yml` | `setup-system`, `setup-docker` | Preparação básica do host + Docker |
| `deploy-server.yml` | `rc-server`, `caddy-server` | `server` (app PHP) + proxy Caddy |
| `deploy-compiler.yml` | `setup-docker`, `rc-compiler` | `runcodes-compiler` (consome `runcodes-compiler-images` e `runcodes-compiler-sandbox` via pull das imagens publicadas no ghcr.io) |
| `deploy-postgres.yml` | `data-postgres` | Postgres com o schema de produção (`database`) |
| `deploy-redis.yml` | `data-redis` | Redis (cache/sessão do `server`; fila BullMQ do worker de plágio) |
| `deploy-seaweed.yml` | `data-seaweed`, `caddy-seaweed` | SeaweedFS (storage S3-compatível) + proxy |

As roles são isoladas por responsabilidade, sem dependência cruzada — seguras de alterar em isolamento desde que os [contratos externos](../architecture/contratos.md) (env vars, buckets, credenciais) sejam preservados.

## Configuração

- `ansible.cfg` — roles locais + local de instalação da galaxy.
- `requirements.yml` — dependências externas (`ansible-galaxy install -r requirements.yml`).
- `inventories/` — hosts por ambiente.
- `vars/vars.yml` — **não commitado** (copiar de `vars.yml.example`): credenciais, domínios, chaves S3. Precisa casar com as env vars lidas por `server`, `runcodes-api` e `runcodes-compiler` — ver a tabela em [Contratos](../architecture/contratos.md).

## Execução típica

```bash
ansible-galaxy install -r requirements.yml
ansible-playbook -i ./inventories/<ambiente>.yml playbooks/<playbook>.yml
```

## Ambiente local

Pra desenvolvimento, o `local-dev` (Docker Compose) sobe o conjunto integrado: Postgres, SeaweedFS, Redis, smtp4dev (SMTP de teste com UI em `localhost:8081`), `runcodes-compiler` e as APIs. É o ambiente contra o qual os testes de integração do `runcodes-api` rodam ([testing](../backend/testing.md#integração--npm-run-testintegration)).
