#!/usr/bin/env bash
# DESLIGA o runcodes por completo e deixa uma cópia dos dados com você.
#
# Ordem (cada passo aborta o script se falhar, antes de qualquer destruição):
#   1. backup final na instância (pg_dump + arquivos) -> S3
#   2. download desse backup para uma pasta local (fora da AWS)
#   3. desativa o workflow de deploy (senão o próximo merge recria tudo)
#   4. esvazia o bucket de backups e roda `terraform destroy`
#   5. com --include-state: remove também bucket de state e tabela de lock
#
# Uso: AWS_PROFILE=<profile> infra/scripts/teardown.sh [--include-state] [--dest DIR]
# Irreversível. Pede que você digite "destruir runcodes".
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$ROOT_DIR/infra/terraform"
REGION="${AWS_REGION:-us-east-1}"
INCLUDE_STATE=false
DEST="$HOME/runcodes-final-backup-$(date +%Y%m%d)"

while [ $# -gt 0 ]; do
  case "$1" in
    --include-state) INCLUDE_STATE=true ;;
    --dest) DEST="$2"; shift ;;
    *) echo "flag desconhecida: $1" >&2; exit 1 ;;
  esac
  shift
done

INSTANCE_ID="$(terraform -chdir="$TF_DIR" output -raw instance_id)"
BUCKET="$(terraform -chdir="$TF_DIR" output -raw backup_bucket)"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"

echo "Conta $ACCOUNT, instância $INSTANCE_ID, bucket $BUCKET"
echo "Isto DESTRÓI toda a infraestrutura do runcodes nesta conta."
read -r -p 'Digite "destruir runcodes" para continuar: ' CONFIRM
[ "$CONFIRM" = "destruir runcodes" ] || { echo "Abortado."; exit 1; }

echo "==> 1/5 Backup final"
CMD_ID="$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript --parameters 'commands=["bash /opt/runcodes/infra/scripts/backup.sh"]' \
  --query Command.CommandId --output text)"
aws ssm wait command-executed --region "$REGION" --command-id "$CMD_ID" --instance-id "$INSTANCE_ID"
STATE="$(aws ssm get-command-invocation --region "$REGION" --command-id "$CMD_ID" --instance-id "$INSTANCE_ID" --query Status --output text)"
[ "$STATE" = "Success" ] || { echo "backup final falhou ($STATE); nada foi destruído" >&2; exit 1; }

echo "==> 2/5 Download para $DEST"
mkdir -p "$DEST"
aws s3 sync "s3://$BUCKET/" "$DEST/" --only-show-errors
ls "$DEST"/postgres/*.dump >/dev/null 2>&1 || { echo "dump não encontrado em $DEST; abortando" >&2; exit 1; }
echo "  $(du -sh "$DEST" | cut -f1) salvos"

echo "==> 3/5 Desativando workflow de deploy"
gh workflow disable deploy.yml || echo "  (não consegui desativar: faça em Actions > Deploy > Disable)"

echo "==> 4/5 Esvaziando backups e destruindo"
aws s3api list-object-versions --bucket "$BUCKET" --output json \
  --query '{Objects: [Versions[],DeleteMarkers[]][][].{Key:Key,VersionId:VersionId}}' |
  jq -c 'select(.Objects != null and (.Objects|length) > 0) | .Objects | _nwise(500) | {Objects: ., Quiet: true}' 2>/dev/null |
  while read -r batch; do
    aws s3api delete-objects --bucket "$BUCKET" --delete "$batch" >/dev/null
  done
terraform -chdir="$TF_DIR" destroy -input=false

if [ "$INCLUDE_STATE" = true ]; then
  echo "==> 5/5 Removendo state e lock"
  SB="runcodes-tfstate-$ACCOUNT"
  aws s3api list-object-versions --bucket "$SB" --output json \
    --query '{Objects: [Versions[],DeleteMarkers[]][][].{Key:Key,VersionId:VersionId}}' |
    jq -c 'select(.Objects != null and (.Objects|length) > 0) | .Objects | _nwise(500) | {Objects: ., Quiet: true}' 2>/dev/null |
    while read -r batch; do
      aws s3api delete-objects --bucket "$SB" --delete "$batch" >/dev/null
    done
  aws s3api delete-bucket --bucket "$SB"
  aws dynamodb delete-table --table-name runcodes-terraform-locks --region "$REGION" >/dev/null
else
  echo "==> 5/5 State mantido (bucket runcodes-tfstate-$ACCOUNT). Use --include-state para remover."
fi

echo "Concluído. Dados em: $DEST"
echo "Resta manual: o repo GitHub e as branches (nada na AWS depende deles)."
