#!/usr/bin/env bash
# Backup lógico para o S3 (roda na instância via systemd timer, diário 03:30 UTC).
# Postgres em formato custom (pg_restore) + volume do Seaweed (arquivos dos
# alunos) em tar.gz. Emite a métrica Runcodes/BackupSuccess; o alarme dispara se
# passar 26 h sem sucesso. Restaurar: infra/docs/segregacao.md.
set -euo pipefail

export AWS_DEFAULT_REGION
IMDS_TOKEN="$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
AWS_DEFAULT_REGION="$(curl -fsS -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/placement/region)"

BUCKET="${BACKUP_BUCKET:-$(aws ssm get-parameter --name /runcodes/prod/BACKUP_BUCKET --query Parameter.Value --output text)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE=(docker compose -f "$ROOT/deploy/compose/docker-compose.prod.yml" --env-file "$ROOT/deploy/compose/.env")
TS="$(date -u +%Y%m%dT%H%M%SZ)"

report() { # 1=sucesso 0=falha
  aws cloudwatch put-metric-data --namespace Runcodes --metric-name BackupSuccess --value "$1" --unit Count || true
}
trap 'report 0' ERR

echo "pg_dump -> s3://$BUCKET/postgres/runcodes-$TS.dump"
"${COMPOSE[@]}" exec -T database pg_dump -U runcodes -Fc runcodes |
  aws s3 cp - "s3://$BUCKET/postgres/runcodes-$TS.dump" --only-show-errors

echo "seaweed -> s3://$BUCKET/files/seaweed-$TS.tar.gz"
docker run --rm -v runcodes_seaweed-data:/d:ro public.ecr.aws/docker/library/alpine:3 tar czf - -C /d . |
  aws s3 cp - "s3://$BUCKET/files/seaweed-$TS.tar.gz" --only-show-errors

report 1
echo "backup ok: $TS"
