#!/usr/bin/env sh
set -eu
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR/.."
zip -r boxpi-shoptet-shipping-addon-production.zip boxpi-shoptet-shipping-addon-production >/dev/null
printf 'Created %s\n' "$ROOT_DIR/../boxpi-shoptet-shipping-addon-production.zip"
