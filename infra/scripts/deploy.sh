#!/usr/bin/env bash
# Orquestrador de deploy (CI e local, mesmo caminho): terraform plan + plan-guard
# -> apply -> espera o SSM da instância -> remote-deploy.sh via SSM -> health
# check pela URL pública.
#
# Flags: --yes (pula a confirmação interativa; uso do CI), --skip-infra
# Requer AWS_PROFILE (local) ou credenciais por env (CI/OIDC), terraform, aws, jq, node.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$ROOT_DIR/infra/terraform"
SHA="${DEPLOY_SHA:-$(git -C "$ROOT_DIR" rev-parse HEAD)}"

AUTO_APPROVE=false
SKIP_INFRA=false
for arg in "$@"; do
  case "$arg" in
    --yes) AUTO_APPROVE=true ;;
    --skip-infra) SKIP_INFRA=true ;;
    *) echo "Flag desconhecida: $arg" >&2; exit 1 ;;
  esac
done

for bin in terraform aws jq node curl; do
  command -v "$bin" >/dev/null || { echo "$bin não encontrado no PATH" >&2; exit 1; }
done
aws sts get-caller-identity >/dev/null || { echo "Credenciais AWS inválidas." >&2; exit 1; }

if [[ "$SKIP_INFRA" == false ]]; then
  echo "==> Terraform init/plan"
  terraform -chdir="$TF_DIR" init -input=false
  terraform -chdir="$TF_DIR" plan -input=false -out=tfplan
  terraform -chdir="$TF_DIR" show -json tfplan | node "$ROOT_DIR/infra/scripts/plan-guard.mjs"
  if [[ "$AUTO_APPROVE" == true ]]; then
    echo "==> --yes: aplicando sem confirmação interativa (CI)"
  else
    read -r -p "Aplicar? (digite 'apply' para confirmar): " CONFIRM
    [[ "$CONFIRM" == "apply" ]] || { echo "Abortado."; exit 1; }
  fi
  terraform -chdir="$TF_DIR" apply -input=false tfplan
fi

INSTANCE_ID="$(terraform -chdir="$TF_DIR" output -raw instance_id)"
PUBLIC_URL="$(terraform -chdir="$TF_DIR" output -raw public_url)"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

echo "==> Aguardando o agente SSM da instância $INSTANCE_ID"
for i in $(seq 1 60); do
  status="$(aws ssm describe-instance-information --region "$REGION" \
    --filters "Key=InstanceIds,Values=$INSTANCE_ID" \
    --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || true)"
  [[ "$status" == "Online" ]] && break
  echo "  SSM: ${status:-aguardando} ($i/60)"
  sleep 10
done
[[ "$status" == "Online" ]] || { echo "ERRO: instância não ficou Online no SSM." >&2; exit 1; }

echo "==> Deploy remoto do commit $SHA"
REMOTE_CMD="set -eo pipefail
cloud-init status --wait >/dev/null 2>&1 || true
cd /opt/runcodes
git fetch --depth 50 origin ${SHA}
git checkout -f --detach ${SHA}
bash infra/scripts/remote-deploy.sh 2>&1 | tee -a /var/log/runcodes-deploy.log"

PARAMS="$(jq -n --arg c "$REMOTE_CMD" '{commands:[$c], executionTimeout:["5400"]}')"
COMMAND_ID="$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript --parameters "$PARAMS" \
  --timeout-seconds 600 --query Command.CommandId --output text)"
echo "  command-id: $COMMAND_ID"

while true; do
  state="$(aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" --query Status --output text 2>/dev/null || echo Pending)"
  case "$state" in
    Success) break ;;
    Failed | Cancelled | TimedOut)
      echo "ERRO: deploy remoto terminou em $state. Fim da saída:" >&2
      aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" \
        --instance-id "$INSTANCE_ID" --query '[StandardOutputContent,StandardErrorContent]' --output text >&2 || true
      exit 1
      ;;
    *) sleep 20 ;;
  esac
done
aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" --query StandardOutputContent --output text | tail -n 25

echo "==> Health check público: $PUBLIC_URL/api/health"
curl -fsS --retry 10 --retry-delay 10 --retry-connrefused --retry-all-errors --max-time 15 \
  "$PUBLIC_URL/api/health"
echo ""
curl -fsS --retry 3 --retry-delay 5 --max-time 15 -o /dev/null -w "frontend: HTTP %{http_code}\n" "$PUBLIC_URL/"
curl -fsS --retry 3 --retry-delay 5 --max-time 15 -o /dev/null -w "banco (/api/universities): HTTP %{http_code}\n" "$PUBLIC_URL/api/universities"
echo "==> Deploy concluído: $PUBLIC_URL"
