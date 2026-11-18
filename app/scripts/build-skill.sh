#!/usr/bin/env bash
# Packs skills/epms-task-plan into public/epms-task-plan.zip, the file PMs download
# from the Import tasks dialog and upload to Claude. Run after editing the skill.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f public/epms-task-plan.zip
(cd ../skills && zip -q -r -X ../app/public/epms-task-plan.zip epms-task-plan)
echo "Wrote public/epms-task-plan.zip"
