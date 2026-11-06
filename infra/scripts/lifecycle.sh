#!/usr/bin/env bash
# Pausar/retomar o runcodes sem destruir nada.
#   pause   : para a instância e silencia os alarmes (custo cai para disco + IP
#             + CloudFront ocioso, ~US$ 8/mês).
#   resume  : liga a instância, reativa os alarmes e espera o health.
#   status  : estado da instância e do endpoint público.
# Uso: AWS_PROFILE=<profile> infra/scripts/lifecycle.sh pause|resume|status
set -euo pipefail

TF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../terraform" && pwd)"
INSTANCE_ID="$(terraform -chdir="$TF_DIR" output -raw instance_id)"
PUBLIC_URL="$(terraform -chdir="$TF_DIR" output -raw public_url)"
REGION="${AWS_REGION:-us-east-1}"

alarms() {
  aws cloudwatch describe-alarms --region "$REGION" --alarm-name-prefix runcodes- \
    --query 'MetricAlarms[].AlarmName' --output text
}

case "${1:-status}" in
  pause)
    # shellcheck disable=SC2046
    aws cloudwatch disable-alarm-actions --region "$REGION" --alarm-names $(alarms)
    aws ec2 stop-instances --region "$REGION" --instance-ids "$INSTANCE_ID" >/dev/null
    aws ec2 wait instance-stopped --region "$REGION" --instance-ids "$INSTANCE_ID"
    echo "pausado. Retome com: $0 resume"
    ;;
  resume)
    aws ec2 start-instances --region "$REGION" --instance-ids "$INSTANCE_ID" >/dev/null
    aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"
    # shellcheck disable=SC2046
    aws cloudwatch enable-alarm-actions --region "$REGION" --alarm-names $(alarms)
    curl -fsS --retry 20 --retry-delay 15 --retry-connrefused --retry-all-errors --max-time 15 \
      "$PUBLIC_URL/api/health"
    echo ""
    echo "no ar: $PUBLIC_URL"
    ;;
  status)
    aws ec2 describe-instances --region "$REGION" --instance-ids "$INSTANCE_ID" \
      --query 'Reservations[0].Instances[0].State.Name' --output text
    curl -sS --max-time 10 -o /dev/null -w "$PUBLIC_URL/api/health -> HTTP %{http_code}\n" "$PUBLIC_URL/api/health" || true
    ;;
  *)
    echo "uso: $0 pause|resume|status" >&2
    exit 1
    ;;
esac
