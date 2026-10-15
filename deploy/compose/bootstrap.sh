#!/usr/bin/env bash
# Bootstrap do run.codes num servidor único (Linux + Docker) — monorepo.
#
# O que ele faz, em ordem:
#   1. clona o repositório `database` (schema legado compartilhado) em .external/
#   2. builda a cadeia de imagens do compilador (sandbox → base → linguagens)
#   3. baixa o jar do JPlag pro worker de plágio
#   4. sobe o stack inteiro com docker compose
#
# Uso (da raiz do monorepo ou de deploy/compose):
#   ./bootstrap.sh            # tudo
#   ./bootstrap.sh images     # só a cadeia de imagens de linguagem
#   ./bootstrap.sh up         # só compose up (imagens já prontas)
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")" && pwd)"
RC_ROOT="$(cd "${COMPOSE_DIR}/../.." && pwd)"
RC_ORG="${RC_ORG:-runcodes-icmc}"
RC_GIT_BASE="${RC_GIT_BASE:-https://github.com/${RC_ORG}}"

LANGS="${RC_LANGS:-c cpp python java go rust haskell pascal fortran portugol r octave dotnet lua julia prolog zig c-omp c-omp-mpi cpp-omp cpp-omp-mpi verilog vhdl}"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

fetch_database() {
  step "Repositório database (schema) em ${RC_ROOT}/.external"
  if [ -d "${RC_ROOT}/.external/database/.git" ]; then
    echo "  já clonado, mantendo como está"
  else
    mkdir -p "${RC_ROOT}/.external"
    git clone --depth 1 "${RC_GIT_BASE}/database.git" "${RC_ROOT}/.external/database"
  fi
}

build_images() {
  step "Sandbox (binário C de limites de recursos)"
  docker build -t "ghcr.io/${RC_ORG}/runcodes-compiler-sandbox:latest" "${RC_ROOT}/compiler-sandbox"

  step "Imagem base das linguagens"
  docker build -t "ghcr.io/${RC_ORG}/runcodes-compiler-images-base:latest" \
    -f "${RC_ROOT}/compiler-images/base/Dockerfile" "${RC_ROOT}/compiler-images/base"

  step "Imagens por linguagem (${LANGS})"
  for lang in ${LANGS}; do
    echo "  -> ${lang}"
    docker build -t "ghcr.io/${RC_ORG}/runcodes-compiler-images-${lang}:latest" \
      -f "${RC_ROOT}/compiler-images/${lang}/Dockerfile" "${RC_ROOT}/compiler-images/${lang}"
  done
}

fetch_jplag() {
  step "JPlag (worker de plágio)"
  if [ -f "${RC_ROOT}/api/vendor/jplag/jplag.jar" ]; then
    echo "  jar já presente"
  else
    (cd "${RC_ROOT}/api" && ./scripts/fetch-jplag.sh)
  fi
}

compose_up() {
  step "Subindo o stack"
  if [ ! -f "${COMPOSE_DIR}/.env" ]; then
    echo "ERRO: crie ${COMPOSE_DIR}/.env a partir do .env.example antes de subir." >&2
    exit 1
  fi
  # shellcheck disable=SC1091
  . "${COMPOSE_DIR}/.env"
  mkdir -p "${RC_EXEC_DIR:?RC_EXEC_DIR não definido no .env}"
  docker compose -f "${COMPOSE_DIR}/docker-compose.prod.yml" --env-file "${COMPOSE_DIR}/.env" up -d --build
  step "Pronto. Acompanhe com: docker compose -f ${COMPOSE_DIR}/docker-compose.prod.yml logs -f"
}

case "${1:-all}" in
  database) fetch_database ;;
  images)   build_images ;;
  jplag)    fetch_jplag ;;
  up)       compose_up ;;
  all)      fetch_database; build_images; fetch_jplag; compose_up ;;
  *) echo "uso: $0 [all|database|images|jplag|up]" >&2; exit 1 ;;
esac
