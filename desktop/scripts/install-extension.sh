#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${REPO_ROOT}/extension/dist"
DST="${HOME}/.pi/agent/extensions/pi-watch"

if [[ ! -d "${SRC}" ]]; then
  echo "error: ${SRC} does not exist. Run 'npm run build --workspace extension' first." >&2
  exit 1
fi

mkdir -p "${HOME}/.pi/agent/extensions"
ln -sfn "${SRC}" "${DST}"
echo "installed: ${DST} -> ${SRC}"
