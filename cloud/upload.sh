#!/usr/bin/env bash
# Uploads a photo or an edited draft to the bucket, waits for the workflow runs it starts, and
# prints what each agent answered. A photo starts the listing agent, the draft it writes starts
# the publisher agent, and an approved draft gets a package.
# Usage: cloud/upload.sh <file>
set -euo pipefail
cd "$(dirname "$0")/.."
source cloud/config.sh

file=${1:?Usage: cloud/upload.sh <photo or draft>}
object=$UPLOAD_FOLDER/$(basename "$file")
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)

run gcloud storage cp "$file" "gs://$BUCKET/$object" --project="$PROJECT"

# Waits until at least one run started after the upload, none is still running, and no new one
# has started for 30 seconds. A draft written by the agent starts the next run a little later.
list_runs() {
  gcloud workflows executions list "$WORKFLOW" --project="$PROJECT" --location="$REGION" \
    --filter="startTime>=$started" --sort-by=startTime --format='value(name.basename(),state)'
}
echo
echo "Waiting for the workflow runs (up to 10 minutes) ..."
quiet_for=0
for _ in $(seq 1 60); do
  sleep 10
  runs=$(list_runs)
  if [ -n "$runs" ] && ! grep -q ACTIVE <<<"$runs"; then
    count=$(wc -l <<<"$runs")
    if [ "${last_count:-0}" -eq "$count" ]; then
      quiet_for=$((quiet_for + 10))
    else
      quiet_for=0
    fi
    last_count=$count
    [ "$quiet_for" -lt 30 ] || break
  fi
done

while read -r id state; do
  [ -n "$id" ] || continue
  echo
  echo "== Run $id: $state"
  gcloud workflows executions describe "$id" --workflow="$WORKFLOW" --project="$PROJECT" \
    --location="$REGION" --format='value(result,error.payload)'
done <<<"$(list_runs)"

echo
echo "The files in the bucket:"
gcloud storage ls "gs://$BUCKET/$UPLOAD_FOLDER/" --project="$PROJECT"
