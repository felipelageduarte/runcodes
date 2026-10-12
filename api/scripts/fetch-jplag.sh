#!/usr/bin/env bash
# Downloads the JPlag CLI jar into vendor/jplag/ — not committed to git
# (it's an 80MB+ fat jar). Required for JPlagProvider; set JPLAG_JAR_PATH
# if you put it somewhere else.
set -euo pipefail

VERSION="${JPLAG_VERSION:-6.3.0}"
DEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/vendor/jplag"
DEST_FILE="$DEST_DIR/jplag.jar"
URL="https://github.com/jplag/JPlag/releases/download/v${VERSION}/jplag-${VERSION}-jar-with-dependencies.jar"

mkdir -p "$DEST_DIR"
echo "Downloading JPlag ${VERSION} to ${DEST_FILE}..."
curl -sL -o "$DEST_FILE" "$URL"
echo "Done. Set JPLAG_JAR_PATH=${DEST_FILE} (or leave default: vendor/jplag/jplag.jar)."
