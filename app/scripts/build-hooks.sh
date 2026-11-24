#!/usr/bin/env bash
# Packs ../pb_hooks into public/spms-hooks.zip, the file the setup check offers PMs to upload to their instance.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d ../pb_hooks ]; then
  echo "No ../pb_hooks here (app folder on its own): using the committed public/spms-hooks.zip"
  exit 0
fi
rm -f public/spms-hooks.zip
(cd .. && zip -q -r -X app/public/spms-hooks.zip pb_hooks -x 'pb_hooks/*.d.ts')
echo "Wrote public/spms-hooks.zip"
