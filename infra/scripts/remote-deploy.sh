#!/usr/bin/env bash
# Roda NA INSTÂNCIA (root), disparado pelo workflow via SSM:
#   cd /opt/runcodes && git checkout -f <sha> && bash infra/scripts/remote-deploy.sh
#
# 1. host-setup (idempotente)  2. segredos no SSM (gerados uma vez)
# 3. .env a partir do SSM       4. imagens de linguagem (só se mudaram/faltam)
# 5. build web/docs             6. compose up  7. health local
#
# Segredos da aplicação nascem aqui e vão direto para o SSM: nunca passam pelo
# state do Terraform nem pelo log do CI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_DIR="$ROOT/deploy/compose"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.prod.yml"
ENV_FILE="$COMPOSE_DIR/.env"
PREFIX="/runcodes/prod"
DEPLOYED_SHA_FILE="$ROOT/.deployed-sha"

step() { printf '\n==> %s\n' "$*"; }

IMDS_TOKEN="$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
REGION="$(curl -fsS -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/placement/region)"
export AWS_DEFAULT_REGION="$REGION"

step "Host"
bash "$ROOT/infra/scripts/host-setup.sh"

step "Segredos (gerados só se ausentes)"
ensure_secret() { # nome
  if ! aws ssm get-parameter --name "$PREFIX/$1" >/dev/null 2>&1; then
    echo "  gerando $1"
    aws ssm put-parameter --name "$PREFIX/$1" --type SecureString \
      --value "$(openssl rand -hex 32)" >/dev/null
  fi
}
for s in DB_PASSWORD JWT_SECRET SECURITY_SALT S3_KEY S3_SECRET; do ensure_secret "$s"; done

step "Gerando .env a partir do SSM"
# umask restrito SÓ aqui (subshell): vazar para o resto do script deixa arquivos
# do repo database e o jar do JPlag em 0600, ilegíveis para o postgres/node dos
# containers (achado 2026-11-06).
(
umask 077
tmp="$(mktemp)"
aws ssm get-parameters-by-path --path "$PREFIX/" --with-decryption --recursive \
  --query 'Parameters[].[Name,Value]' --output json |
  jq -r --arg p "$PREFIX/" --arg q "'" '.[] | "RC_" + (.[0] | ltrimstr($p)) + "=" + $q + .[1] + $q' >"$tmp"
{
  cat "$tmp"
  echo "RC_APP_DOMAIN=':80'"
  echo "RC_EXEC_DIR='/data/exec'"
  echo "RC_CADDYFILE='./Caddyfile.cloudfront'"
} >"$ENV_FILE"
rm -f "$tmp"
chmod 600 "$ENV_FILE"
)
# shellcheck disable=SC1090
. "$ENV_FILE"
[ -n "${RC_SMTP_HOST:-}" ] || echo "AVISO: SMTP não configurado (/runcodes/prod/SMTP_*): e-mails de cadastro/reset não saem."
export RC_LANGS="${RC_COMPILER_LANGS:-c cpp python java}"

step "Repositório database (schema) e JPlag"
bash "$COMPOSE_DIR/bootstrap.sh" database
bash "$COMPOSE_DIR/bootstrap.sh" jplag

# O que entra em imagem precisa ser legível pelos usuários dos containers
# (postgres lê o schema; node lê o jar do JPlag).
chmod -R a+rX "$ROOT/.external" "$ROOT/api/vendor" 2>/dev/null || true

# Self-heal: init do Postgres que falhou deixa o cluster sem o role `runcodes` e
# o container seguinte "pula a inicialização". Sem o role não existe dado de
# aplicação, então recriar o volume vazio é seguro. Nunca dispara num banco são.
heal_half_initialized_db() {
  local db=runcodes-database-1 n
  docker inspect -f '{{.State.Running}}' "$db" 2>/dev/null | grep -qx true || return 0
  n="$(docker exec "$db" psql -U postgres -tAc "select count(*) from pg_roles where rolname='runcodes'" 2>/dev/null || echo err)"
  if [ "$n" = "0" ]; then
    echo "  banco sem o role runcodes (init falhou antes): recriando o volume vazio"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" rm -sf database api plagiarism-worker rcc
    docker volume rm runcodes_db-data
    # a camada COPY antiga carrega o schema com modo 0600: rebuild sem cache
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache database
  fi
}

step "Imagens de linguagem"
need_images=false
for lang in $RC_LANGS; do
  docker image inspect "ghcr.io/runcodes-icmc/runcodes-compiler-images-${lang}:latest" >/dev/null 2>&1 || need_images=true
done
if [ -f "$DEPLOYED_SHA_FILE" ] && git -C "$ROOT" cat-file -e "$(cat "$DEPLOYED_SHA_FILE")^{commit}" 2>/dev/null; then
  if ! git -C "$ROOT" diff --quiet "$(cat "$DEPLOYED_SHA_FILE")" HEAD -- compiler-images compiler-sandbox; then
    need_images=true
  fi
fi
if [ "$need_images" = true ]; then
  bash "$COMPOSE_DIR/bootstrap.sh" images
else
  echo "  imagens em dia"
fi

COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")

step "Build do frontend e da documentação (one-shots, em sequência)"
"${COMPOSE[@]}" run --rm web-build
"${COMPOSE[@]}" run --rm docs-build

step "Banco: checagem de inicialização"
heal_half_initialized_db

step "Subindo o stack"
mkdir -p "$RC_EXEC_DIR"
mapfile -t services < <("${COMPOSE[@]}" config --services | grep -vx -e web-build -e docs-build)
"${COMPOSE[@]}" up -d --build --remove-orphans "${services[@]}"

step "Health local (Caddy -> API)"
ok=false
for i in $(seq 1 30); do
  if curl -fsS -H "X-Origin-Verify: ${RC_ORIGIN_VERIFY}" http://127.0.0.1/api/health >/dev/null; then
    ok=true
    break
  fi
  echo "  aguardando API ($i/30)"
  sleep 10
done
if [ "$ok" != true ]; then
  echo "ERRO: health local falhou. Estado dos containers:" >&2
  "${COMPOSE[@]}" ps -a >&2
  "${COMPOSE[@]}" logs --tail 40 api >&2 || true
  exit 1
fi

# /api/health não toca o banco: o smoke consulta uma rota que lê do Postgres.
step "Smoke com banco (GET /api/universities)"
curl -fsS -H "X-Origin-Verify: ${RC_ORIGIN_VERIFY}" http://127.0.0.1/api/universities >/dev/null || {
  echo "ERRO: rota com banco falhou (credencial ou schema do Postgres):" >&2
  "${COMPOSE[@]}" logs --tail 30 api >&2 || true
  exit 1
}

git -C "$ROOT" rev-parse HEAD >"$DEPLOYED_SHA_FILE"
docker image prune -f >/dev/null
echo "Deploy concluído: $(cat "$DEPLOYED_SHA_FILE")"
