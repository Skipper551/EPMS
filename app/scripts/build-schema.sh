#!/usr/bin/env bash
# Copies ../pb_schema.json into src/generated/, where the setup check imports it from.
# The copy is committed, so the app folder builds on its own (PocketBase Cloud frontends build
# only this folder). With the whole repository present, every build refreshes it: commit the change.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f ../pb_schema.json ]; then
  echo "No ../pb_schema.json here (app folder on its own): using the committed src/generated/pb_schema.json"
  exit 0
fi
mkdir -p src/generated
if ! cmp -s ../pb_schema.json src/generated/pb_schema.json; then
  cp ../pb_schema.json src/generated/pb_schema.json
  echo "Updated src/generated/pb_schema.json from ../pb_schema.json. Commit it with your schema change."
fi
