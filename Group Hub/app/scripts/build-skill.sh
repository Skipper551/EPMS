#!/usr/bin/env bash
# Packs skills/group-hub-task-plan into public/group-hub-task-plan.zip, the file PMs download
# from the Import tasks dialog and upload to Claude. Run after editing the skill.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f public/group-hub-task-plan.zip
(cd ../skills && zip -q -r -X ../app/public/group-hub-task-plan.zip group-hub-task-plan)
echo "Wrote public/group-hub-task-plan.zip"
