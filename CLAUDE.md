# run.codes (monorepo)

Plataforma de submissão e correção automática de exercícios. Módulos: `web/` (React/Vite), `api/`
(Express/Prisma), `compiler/` (worker Python), `compiler-images/`, `compiler-sandbox/` (C), `docs/`
(Docusaurus). README tem o mapa; cada módulo tem o seu.

## Produção (AWS)

Infra, CI/CD e operação em [`infra/`](infra/README.md): EC2 única + CloudFront, Terraform isolado
(state `runcodes-tfstate-220395825071`), conta `220395825071`, `us-east-1`. Merge na `main` = deploy.

- PR obrigatório; checks `test`, `terraform-plan`, `security` verdes; commits assinados. Detalhes e
  como aplicar o ruleset: `infra/docs/ci-cd.md`.
- Deploy só por `infra/scripts/deploy.sh` (CI ou local). Nada criado à mão na AWS.
- Antes de mexer em `infra/`: `terraform fmt -recursive` e `validate`; o merge aplica com
  AdministratorAccess. Plan-guard barra destruir host, volume de dados, VPC, CloudFront, buckets, IAM.
- Segredos só no SSM `/runcodes/prod/*`. Repositório público: nunca commitar `.env` nem credencial.
- Acesso à instância por SSM (sem SSH). Banco de produção: leitura por padrão, pela instância
  (`docker compose exec database psql`); escrita só com pedido explícito.
- Pausar, mover de conta e desligar: `infra/docs/segregacao.md`.

## Testes (o que o CI roda)

- `api`: `npm ci && npx prisma generate && npm run build && npm test`
- `web`: `npm ci && npm run lint && npm test && npm run build`
- `docs`: `npm run typecheck && npm run build`
- `compiler`: `uv sync --frozen`, `ruff check src`, unittest dos `test_*.py` de topo (os de
  `tests/engine` exigem Docker e imagens)
- `infra`: `node --test infra/scripts/`, `terraform fmt -check`, `validate`, checkov, semgrep

## Achados

- 2026-11-06: semgrep apontou `api/Dockerfile` rodando como root; agora `USER node` (worker volta a
  root só para o apt). Causa: imagem base sem `USER`. Regra: container de aplicação sempre não-root.
- 2026-11-06: `*.tfvars` está sob regra de leitura negada no ambiente do dono; o stack usa só defaults
  de `variables.tf`. Não criar `environments/*.tfvars`.
