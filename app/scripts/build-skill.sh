#!/usr/bin/env bash
# Packs skills/spms-task-plan into public/spms-task-plan.zip, the file PMs download
# from the Import tasks dialog and upload to Claude. Run after editing the skill.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d ../skills/spms-task-plan ]; then
  echo "No ../skills here (app folder on its own): using the committed public/spms-task-plan.zip"
  exit 0
fi
rm -f public/spms-task-plan.zip
(cd ../skills && zip -q -r -X ../app/public/spms-task-plan.zip spms-task-plan)
echo "Wrote public/spms-task-plan.zip"
