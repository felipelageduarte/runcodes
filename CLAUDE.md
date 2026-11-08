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
- Revisões completas (`/revisao`) em `docs/reviews/`; specs SDD em `docs/specs/`. Antes de abrir ao público: `docs/specs/onda-1-antes-de-abrir.md`.

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
- 2026-11-06: o `npm audit` do primeiro PR barrou a API (multer, body-parser, zod high; nodemailer,
  qs, minimatch moderate). `npm audit fix` + zod 3 -> 4 (build e 362 testes verdes). No web, zod 4 faz
  `z.coerce.number()` virar `unknown` e quebra o tipo de ~12 telas com react-hook-form: o web ficou em
  zod 3 e o gate dele em `critical` até migrar (usar `useForm<z.input<S>, any, z.output<S>>`).
  Regra: o gate `high` vale para o servidor; exceção só com advisory de impacto local e prazo.
- 2026-11-06: `node --test <diretório>` falha no Node 24 (`Cannot find module`); passar os arquivos
  (`infra/scripts/*.test.mjs`). O passo nunca tinha rodado local antes do CI.
- 2026-11-06: primeiro deploy aplicou a infra (55 recursos) e falhou no host: `mkfs.xfs -L runcodes-data`
  tem rótulo de 13 caracteres e o xfs aceita 12 (`Usage: mkfs.xfs`). Causa: script de host nunca rodou
  num Linux real antes do deploy. Regra: rótulo xfs até 12 caracteres (`rcdata`); `bash -n` não pega
  erro de argumento, então script de host novo roda numa instância descartável antes de ir à `main`.
- 2026-11-06: segundo deploy passou do `host-setup` e quebrou ao gerar o `.env`
  (`line 1: +: command not found`): o programa `jq` estava entre aspas simples do shell e continha aspas
  simples (o `'` virou `'` ao gravar o arquivo). Regra: aspa dentro de filtro `jq` vai por
  `--arg q "'"`; filtro de script se testa com dado fictício localmente antes do PR.
- 2026-11-06: branch criada de um `main` local desatualizado deu PR em conflito e o guard bloqueia force
  push. Regra: `git fetch` e branch a partir de `origin/main`, nunca do `main` local.
- 2026-11-06: terceiro deploy "passou" mas `/api/universities` deu 500 (`password authentication failed for
  user "runcodes"`). Causa: o `umask 077` do trecho do `.env` valia para o resto do `remote-deploy.sh`; o
  clone do repo `database` ficou 0600, o `postgres` do container não leu `01-init.sql`
  (`Permission denied`), o init morreu no meio e o restart pulou a inicialização, sem o role. O
  `/api/health` não toca o banco, então o health check e o smoke ficaram verdes. Regra: umask restrito só em
  subshell; o smoke pós-deploy precisa tocar o banco (ver `deploy.sh`).
- 2026-11-06: o primeiro backup manual falhou (`upload failed: - to s3://AQICAHiz...`): o checkov pediu
  parâmetros SSM criptografados, viraram `SecureString`, e `aws ssm get-parameter` sem `--with-decryption`
  devolve o blob cifrado, que o `backup.sh` usou como nome de bucket. Regra: todo `get-parameter` de
  parâmetro `SecureString` leva `--with-decryption`; o timer só roda às 03:30 UTC, então o backup precisa
  ser disparado à mão logo após o deploy (alarme `backup-stale` avisa).
- 2026-11-06: criar o primeiro admin falhou com `users.confirmation_token_hash does not exist`: a API
  (Prisma) exige 6 migrations (`001` a `006`) que só existiam no clone local de `runcodes-icmc/database`
  (3 commits sem push e 1 arquivo não rastreado); o deploy clona o repo remoto, sem elas. Cadastro,
  reset de senha, plágio, exercícios públicos e broadcast estavam quebrados em produção e o smoke
  (`/api/universities`) não via. Agora as migrations vivem em `api/db/migrations/` e o deploy as aplica
  (`infra/scripts/migrate.sh`). Regra: tudo que o código exige do banco vive no repo que faz o deploy.
- 2026-11-07: o seed do repo `database` (`schema/production.sql`) cria `admin@admin` (ADMIN, confirmado, hash
  SHA-1 legado público), que ficou ativo em produção. Removido à mão (`DELETE`, aprovado pelo dono). Regra:
  após qualquer init novo do banco (recriação do volume, self-heal do `remote-deploy.sh`), conferir
  `SELECT email FROM users` e apagar o `admin@admin` antes de abrir ao público; restore de backup antigo
  também o traz de volta.
