# Operação

Perfil AWS local: `export PATH="/opt/homebrew/bin:$PATH" AWS_PROFILE=felipelageduarte`.

## Deploy

Merge na `main` dispara `.github/workflows/deploy.yml`: testes, depois `infra/scripts/deploy.sh --yes`
(terraform plan + plan-guard, apply, SSM executa `remote-deploy.sh` na instância, health check em
`<url>/api/health`).

```bash
gh run list --workflow deploy.yml --limit 5
gh run watch <id> --exit-status
```

Primeiro deploy: 30 a 60 minutos (build das imagens de linguagem num t4g.small). Os seguintes só
refazem o que mudou (imagens de linguagem só se `compiler-images/` ou `compiler-sandbox/` mudaram).

Deploy manual (hotfix): `infra/scripts/deploy.sh` (pede confirmação). O apply local usa o working
tree de quem roda, não a `main`: commite antes.

## Acesso e logs (sem SSH)

```bash
INSTANCE=$(terraform -chdir=infra/terraform output -raw instance_id)
aws ssm start-session --target "$INSTANCE"
# na instância:
sudo -i
cd /opt/runcodes/deploy/compose
docker compose -f docker-compose.prod.yml --env-file .env ps
docker compose -f docker-compose.prod.yml --env-file .env logs -f --tail 100 api rcc
tail -f /var/log/runcodes-deploy.log
```

## Configuração e segredos

Tudo em SSM Parameter Store sob `/runcodes/prod/` (SecureString). O `.env` do compose é gerado a
cada deploy a partir daí (`RC_<NOME>`). Segredos da aplicação (DB, JWT, salt, S3) são gerados na
primeira execução e nunca passam pelo Terraform. Trocar um valor:

```bash
aws ssm put-parameter --name /runcodes/prod/NOME --type SecureString --overwrite --value '...'
```

`DB_PASSWORD` não se troca assim: o Postgres foi inicializado com ele.

### SMTP

Sem SMTP o cadastro e o reset de senha não enviam e-mail. Defina e redeploy (`gh workflow run deploy.yml`):

```bash
for kv in SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true SMTP_USER=... SMTP_PASSWORD=... SMTP_FROM='run.codes <...>'; do
  aws ssm put-parameter --name "/runcodes/prod/${kv%%=*}" --type SecureString --overwrite --value "${kv#*=}"
done
```

## Migrations do banco

`api/db/migrations/NNN_*.sql` roda no deploy (`infra/scripts/migrate.sh`), em ordem, uma vez cada
(tabela `schema_migrations`), cada arquivo numa transação, **antes** de a API nova subir. Por isso
só migration aditiva (`ADD COLUMN` com default ou nula, `CREATE TABLE/INDEX`); `DROP`/`RENAME`/troca de
tipo só num deploy posterior, quando o código antigo já não usa. Nunca edite migration aplicada: crie a
próxima. O schema base vem do repo `runcodes-icmc/database` (clonado no deploy); tudo que a API exige
além dele mora aqui.

## Mudanças comuns

- **Mais linguagens**: edite `compiler_langs` em `infra/terraform/variables.tf` (cada imagem ocupa
  disco; confira `df -h /data`), PR, merge.
- **Instância maior**: `instance_type` em `variables.tf`. Mudar o tipo para/reinicia a instância (minutos
  fora do ar). O plan-guard não barra update in-place.
- **Disco**: aumente `data_volume_gb`; depois, na instância, `xfs_growfs /data`.
- **Domínio próprio**: ACM em us-east-1, `aliases` e `viewer_certificate` no CloudFront, registro
  Route53, e `PUBLIC_URL` no SSM. Com certificado próprio dá para subir `minimum_protocol_version`
  para TLSv1.2 e religar os checks CKV_AWS_174/CKV2_AWS_42 no `.checkov.yaml`.
- **Front em outro domínio** (hoje `d1m71uoprnvjm9.cloudfront.net`, repositório `RunCodes-sh/web`, CloudFront próprio que
  encaminha `/api/*` e `/docs/*` a esta distribuição): a origem precisa estar em
  `/runcodes/prod/APP_ALLOWED_ORIGINS` (lista separada por vírgula, `cloudfront.tf`), que a instância
  lê como `RC_APP_ALLOWED_ORIGINS` e a API aplica no CORS e na checagem de `Origin`. Sem isso, login e
  toda mutação vindos do domínio novo recebem 403.
- **Console SQL em modo escrita**: desligado por padrão. Para ligar, criar o parâmetro
  `/runcodes/prod/DB_CONSOLE_WRITE_ENABLED` = `true` pelo Terraform (vira `RC_DB_CONSOLE_WRITE_ENABLED` na
  instância) e refazer o deploy. Mesmo ligado, escrita pede conta `DEVELOPER`, confirmação e senha. Desligar
  depois do uso.

## Alarmes (SNS `runcodes-alerts`, e-mail)

Confirme a inscrição SNS no e-mail após o primeiro apply (duas: us-east-1 do health check e do
tópico principal). Alarmes: status da instância (recupera sozinha), créditos de CPU, disco `/` e
`/data` > 80%, memória > 90%, health fim a fim, 5xx no CloudFront, backup sem sucesso por 26 h,
orçamento.

Resposta rápida:

| Alarme | Primeiro passo |
|---|---|
| `health-check-failed` | `lifecycle.sh status`; `docker compose ps`; logs da `api`; `/var/log/runcodes-deploy.log` |
| `disk-data-high` | `docker system df`; `docker image prune -a` (reconstrói o que faltar no próximo deploy) |
| `memory-high` / `cpu-credits-low` | subir `instance_type` |
| `backup-stale` | `systemctl status runcodes-backup`; `journalctl -u runcodes-backup` |

## Rotina

Revisão completa (`/revisao`) a cada milestone, antes de abrir para mais gente, após incidente e a
cada trimestre.
