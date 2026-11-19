#!/usr/bin/env bash
# Packs ../pb_hooks into public/epms-hooks.zip, the file the setup check offers PMs to upload to their instance.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f public/epms-hooks.zip
(cd .. && zip -q -r -X app/public/epms-hooks.zip pb_hooks -x 'pb_hooks/*.d.ts')
echo "Wrote public/epms-hooks.zip"
