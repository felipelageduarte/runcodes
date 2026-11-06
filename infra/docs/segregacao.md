# Segregar, pausar e desligar

## Grau de isolamento hoje

Tudo do runcodes está na conta `220395825071`, mas **sem nenhuma dependência de outro projeto**:

| Item | Como está isolado |
|---|---|
| Rede | VPC própria (`10.60.0.0/24`), sem peering, NAT ou SG compartilhado |
| Banco | Postgres em container no próprio host; não usa o RDS `emboabaduarte-db-production` |
| State | bucket `runcodes-tfstate-<conta>` + tabela `runcodes-terraform-locks`, só dele |
| IAM | roles `runcodes-*` (OIDC, instância, DLM, flow logs); nada reutilizado |
| Identificação | tag `Project=runcodes` em tudo; orçamento filtrado por ela |
| Único compartilhado | o provider OIDC do GitHub da conta (só um por URL é permitido) |

Para listar tudo que pertence ao runcodes:

```bash
aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=runcodes \
  --query 'ResourceTagMappingList[].ResourceARN' --output text | tr '\t' '\n'
```

## Pausar (reversível, minutos)

```bash
infra/scripts/lifecycle.sh pause    # para a instância e silencia alarmes (~US$ 10/mês)
infra/scripts/lifecycle.sh resume   # liga, reativa alarmes, espera o health
```

## Desligar de vez

```bash
infra/scripts/teardown.sh --dest ~/runcodes-final-backup [--include-state]
```

Faz backup final, baixa para a sua máquina, desativa o workflow de deploy, esvazia o bucket de
backups e roda `terraform destroy` (confirmação digitada). Depois, na conta, só sobra o que não é
dele: nada. Com `--include-state` some também o state. A cópia local contém `postgres/*.dump`
(`pg_restore`) e `files/seaweed-*.tar.gz`.

## Mover para outra conta AWS

Quando o runcodes ganhar conta própria (como o botimovel em 2026-10-19):

1. **Conta nova**: crie pelo Organizations, configure um profile SSO (ex.: `runcodes`).
2. **Backup**: dispare um backup manual (`sudo systemctl start runcodes-backup` pela sessão SSM) e
   baixe `aws s3 sync s3://runcodes-backups-220395825071/ ./backup/`.
3. **Código**: em `infra/terraform/versions.tf` troque o bucket do backend
   (`runcodes-tfstate-<nova conta>`); em `ci-github.tf` troque o `data` do provider OIDC por
   `resource "aws_iam_openid_connect_provider"` (a conta nova não tem); nos workflows troque o ARN
   das roles (`arn:aws:iam::<nova conta>:role/runcodes-github-*`).
4. **Infra nova**: `AWS_PROFILE=runcodes infra/scripts/bootstrap-state.sh`, `terraform init`,
   `apply -target` das roles, PR, merge (o deploy sobe a stack inteira e uma URL CloudFront nova).
5. **Dados**: copie os arquivos de backup para o bucket novo, e na instância nova:
   ```bash
   aws s3 cp s3://<bucket novo>/postgres/<dump> - | \
     docker compose -f docker-compose.prod.yml --env-file .env exec -T database pg_restore -U runcodes -d runcodes --clean --if-exists
   aws s3 cp s3://<bucket novo>/files/<tar> - | \
     docker run --rm -i -v runcodes_seaweed-data:/d alpine tar xzf - -C /d
   docker compose -f docker-compose.prod.yml --env-file .env restart
   ```
6. **Virada**: se houver domínio próprio, aponte o DNS para a nova distribuição. Valide, e então
   `teardown.sh` na conta antiga.

## Restore ensaiado

Backup só vale com restore executado e registrado. Ensaio: baixar o dump do S3 e restaurar num
Postgres descartável (`docker run postgres:18-alpine`, sem tocar o banco de produção), conferir a
contagem de tabelas e remover o container. Repetir a cada mudança de schema relevante e a cada
trimestre; só o banco foi ensaiado, os arquivos do Seaweed (tar.gz) ainda não.

| Data | Origem | Tempo | Resultado |
|---|---|---|---|
| 2026-11-06 | `postgres/runcodes-20261106T202615Z.dump` (70,9 KiB) | 5 s | 28 de 28 tabelas, igual à produção (banco ainda sem dados de aluno) |
