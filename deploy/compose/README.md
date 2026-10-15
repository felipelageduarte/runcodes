# run.codes — Deploy em servidor único (Docker Compose)

Deploy do stack moderno (runcodes-web + runcodes-api + runcodes-compiler)
em **qualquer máquina Linux com Docker** — um servidor próprio, uma VM,
ou uma EC2 na AWS. Um comando sobe tudo.

## Requisitos

- Linux x86_64 ou arm64 com **Docker** (inclui o plugin compose) e **git**
- Um **domínio** apontando pro servidor (TLS automático via Let's Encrypt)
- Um **servidor SMTP** (Gmail/Workspace, SES, qualquer um)
- Disco: ≥ 50 GB (imagens de linguagem + arquivos de alunos)

## Passo a passo

```bash
# 1. Clone o monorepo
git clone https://github.com/felipelageduarte/runcodes.git /opt/runcodes

# 2. Configure
cd /opt/runcodes/deploy/compose
cp .env.example .env
$EDITOR .env           # domínio, segredos (openssl rand -hex 32), SMTP

# 3. Suba tudo
./bootstrap.sh
```

O `bootstrap.sh` clona o repositório `database` (schema) em `.external/`,
builda a cadeia de imagens do compilador (sandbox → base → ~23
linguagens), baixa o JPlag e sobe o compose. Primeira execução demora (builda tudo); as seguintes são
incrementais.

### O que sobe

| Serviço | Papel |
|---|---|
| `caddy` | TLS automático, serve o frontend, proxy de `/api` e `/docs` |
| `api` | runcodes-api (Express/Prisma) |
| `plagiarism-worker` | worker de plágio (JPlag/Dolos), fila no Redis |
| `rcc` | runcodes-compiler — roda submissões em containers irmãos |
| `web-build` / `docs-build` | one-shots que buildam frontend e documentação |
| `database` / `redis` / `seaweed` | Postgres, Redis e S3 (SeaweedFS) locais |

### Atualizando

```bash
cd /opt/runcodes && git pull
cd deploy/compose
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Imagens de linguagem novas/alteradas: `./bootstrap.sh images`.

## AWS com serviços gerenciados

O mesmo compose roda numa EC2 (o `rcc` precisa do socket do Docker, então
ECS/Fargate não serve pra ele). Pra tirar o estado da máquina:

1. **RDS (Postgres)**: crie a instância, rode o schema do repo `database`
   (`schema/` + `migrations/`), e no `.env` defina `RC_DATABASE_URL` e
   `RC_DB_HOST` apontando pro RDS.
2. **ElastiCache (Redis)**: defina `RC_REDIS_URL`.
3. **S3 de verdade**: crie os buckets `runcodes-commits`,
   `runcodes-outputfiles`, `runcodes-files`, `runcodes-cases`; defina
   `RC_S3_ENDPOINT=https://s3.<região>.amazonaws.com` e credenciais IAM
   em `RC_S3_KEY`/`RC_S3_SECRET`.
4. Remova (ou simplesmente ignore) os serviços `database`, `redis`,
   `seaweed` e `seaweed-init` do compose.

API e compiler são 100% configuráveis por variável de ambiente — nada no
código distingue SeaweedFS de S3 real ou Postgres local de RDS.

## Multi-servidor (Ansible)

Pra separar banco/storage/compiladores em máquinas distintas, use os
playbooks em `../playbooks` (`deploy-postgres`, `deploy-redis`,
`deploy-seaweed`, `deploy-compiler`, `deploy-server`) — veja o README na
raiz do repo `deploy`.

## Notas operacionais

- **Renomeação dos repositórios (2026-10)**: `compiler-engine` →
  `runcodes-compiler`, `compiler-monitor` → `runcodes-compiler-sandbox`,
  `compiler-images` → `runcodes-compiler-images`. As imagens Docker
  seguem os nomes novos (`ghcr.io/runcodes-icmc/runcodes-compiler-images-<lang>`).
  Se a organização no GitHub ainda usa os nomes antigos, renomeie os
  repositórios lá (Settings → Rename) — redirects do GitHub mantêm os
  clones antigos funcionando.
- A documentação fica em `https://<domínio>/docs/manual/intro/` (pública)
  e embutida no painel admin (`/admin/documentacao`, atrás de login).
- Backup: volumes `db-data` e `seaweed-data` são o estado que importa.
