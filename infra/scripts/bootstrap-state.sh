#!/usr/bin/env bash
# Cria (uma única vez) o bucket de state e a tabela de lock do Terraform do
# runcodes. Fora do Terraform por dependência circular. Idempotente.
#
# Uso: AWS_PROFILE=<profile> infra/scripts/bootstrap-state.sh [região]
# O nome do bucket tem de bater com o backend em infra/terraform/versions.tf.
set -euo pipefail

REGION="${1:-us-east-1}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="runcodes-tfstate-${ACCOUNT}"
TABLE="runcodes-terraform-locks"

echo "conta=$ACCOUNT região=$REGION bucket=$BUCKET tabela=$TABLE"

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "bucket já existe"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi

aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-bucket-tagging --bucket "$BUCKET" \
  --tagging 'TagSet=[{Key=Project,Value=runcodes},{Key=ManagedBy,Value=bootstrap-state.sh}]'

if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo "tabela de lock já existe"
else
  aws dynamodb create-table --table-name "$TABLE" --region "$REGION" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --tags Key=Project,Value=runcodes Key=ManagedBy,Value=bootstrap-state.sh >/dev/null
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
fi
echo "ok. Próximo: terraform -chdir=infra/terraform init"
