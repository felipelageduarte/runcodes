#!/usr/bin/env bash
# Prepara o host (Amazon Linux 2023 arm64): volume de dados, swap, Docker,
# CloudWatch Agent e timer de backup. Idempotente: roda no primeiro boot
# (user_data) e a cada deploy (remote-deploy.sh). Precisa de root.
set -euo pipefail

COMPOSE_VERSION="v2.29.7"
BUILDX_VERSION="v0.17.1"
DATA_DIR="/data"
SWAP_FILE="/swapfile"
SWAP_MB=2048

log() { printf '[host-setup] %s\n' "$*"; }

install_packages() {
  local pkgs=()
  for p in docker git jq xfsprogs amazon-cloudwatch-agent; do
    rpm -q "$p" >/dev/null 2>&1 || pkgs+=("$p")
  done
  if [ "${#pkgs[@]}" -gt 0 ]; then
    log "instalando: ${pkgs[*]}"
    dnf install -y "${pkgs[@]}"
  fi
}

# Volume de dados: o disco extra (não-root) vira /data. Formata só se vazio.
setup_data_volume() {
  if mountpoint -q "$DATA_DIR"; then
    return
  fi
  local root_src root_disk dev
  root_src="$(findmnt -no SOURCE /)"
  root_disk="/dev/$(lsblk -no PKNAME "$root_src" | head -1)"
  for _ in $(seq 1 30); do
    dev="$(lsblk -dpno NAME,TYPE | awk '$2=="disk"{print $1}' | grep -vx "$root_disk" | head -1 || true)"
    [ -n "$dev" ] && break
    sleep 2
  done
  [ -n "${dev:-}" ] || { echo "volume de dados não apareceu" >&2; exit 1; }
  if ! blkid "$dev" >/dev/null 2>&1; then
    log "formatando $dev (xfs)"
    mkfs.xfs -L rcdata "$dev"
  fi
  mkdir -p "$DATA_DIR"
  local uuid
  uuid="$(blkid -s UUID -o value "$dev")"
  grep -q "$uuid" /etc/fstab || echo "UUID=$uuid $DATA_DIR xfs defaults,nofail 0 2" >>/etc/fstab
  mount "$DATA_DIR"
  mkdir -p "$DATA_DIR/docker" "$DATA_DIR/exec"
}

setup_swap() {
  if swapon --show=NAME --noheadings | grep -qx "$SWAP_FILE"; then
    return
  fi
  if [ ! -f "$SWAP_FILE" ]; then
    log "criando swap de ${SWAP_MB} MB"
    dd if=/dev/zero of="$SWAP_FILE" bs=1M count="$SWAP_MB" status=none
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE" >/dev/null
  fi
  swapon "$SWAP_FILE"
  grep -q "$SWAP_FILE" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >>/etc/fstab
  sysctl -w vm.swappiness=20 >/dev/null
  echo 'vm.swappiness=20' >/etc/sysctl.d/99-runcodes.conf
}

# Baixa binário de release do GitHub e confere o SHA-256 publicado junto.
fetch_verified() { # url sha_url dest [sha_filter]
  local url="$1" sha_url="$2" dest="$3" filter="${4:-}" tmp expected actual
  tmp="$(mktemp)"
  curl -fsSL "$url" -o "$tmp"
  if [ -n "$filter" ]; then
    expected="$(curl -fsSL "$sha_url" | grep -F "$filter" | awk '{print $1}' | head -1)"
  else
    expected="$(curl -fsSL "$sha_url" | awk '{print $1}' | head -1)"
  fi
  actual="$(sha256sum "$tmp" | awk '{print $1}')"
  if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
    echo "SHA-256 inválido para $url (esperado '$expected', obtido '$actual')" >&2
    rm -f "$tmp"
    exit 1
  fi
  install -m 0755 "$tmp" "$dest"
  rm -f "$tmp"
}

setup_docker() {
  mkdir -p /etc/docker /usr/local/lib/docker/cli-plugins
  cat >/etc/docker/daemon.json <<JSON
{
  "data-root": "${DATA_DIR}/docker",
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  if [ ! -x /usr/local/lib/docker/cli-plugins/docker-compose ] ||
    ! /usr/local/lib/docker/cli-plugins/docker-compose version 2>/dev/null | grep -q "${COMPOSE_VERSION#v}"; then
    log "instalando docker compose ${COMPOSE_VERSION}"
    local base="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}"
    fetch_verified "$base/docker-compose-linux-aarch64" "$base/docker-compose-linux-aarch64.sha256" \
      /usr/local/lib/docker/cli-plugins/docker-compose
  fi
  if [ ! -x /usr/local/lib/docker/cli-plugins/docker-buildx ] ||
    ! /usr/local/lib/docker/cli-plugins/docker-buildx version 2>/dev/null | grep -q "${BUILDX_VERSION}"; then
    log "instalando docker buildx ${BUILDX_VERSION}"
    local base="https://github.com/docker/buildx/releases/download/${BUILDX_VERSION}"
    fetch_verified "$base/buildx-${BUILDX_VERSION}.linux-arm64" "$base/checksums.txt" \
      /usr/local/lib/docker/cli-plugins/docker-buildx "buildx-${BUILDX_VERSION}.linux-arm64"
  fi
  systemctl enable --now docker
  # daemon.json só vale após restart; reinicia só se o data-root divergir.
  if ! docker info --format '{{.DockerRootDir}}' | grep -qx "${DATA_DIR}/docker"; then
    systemctl restart docker
  fi
}

setup_cloudwatch_agent() {
  mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
  cat >/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'JSON'
{
  "agent": { "metrics_collection_interval": 300, "run_as_user": "root" },
  "metrics": {
    "append_dimensions": { "InstanceId": "${aws:InstanceId}" },
    "metrics_collected": {
      "disk": {
        "resources": ["/", "/data"],
        "measurement": ["disk_used_percent"],
        "drop_device": true
      },
      "mem": { "measurement": ["mem_used_percent"] }
    }
  }
}
JSON
  /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json >/dev/null
}

setup_backup_timer() {
  cat >/etc/systemd/system/runcodes-backup.service <<'UNIT'
[Unit]
Description=Backup do runcodes (pg_dump + arquivos para o S3)

[Service]
Type=oneshot
ExecStart=/opt/runcodes/infra/scripts/backup.sh
UNIT
  cat >/etc/systemd/system/runcodes-backup.timer <<'UNIT'
[Unit]
Description=Backup diario do runcodes

[Timer]
OnCalendar=*-*-* 03:30:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now runcodes-backup.timer
}

install_packages
setup_data_volume
setup_swap
setup_docker
setup_cloudwatch_agent
setup_backup_timer
log "ok"
