#!/usr/bin/env bash
# Deletes everything cloud/setup.sh and cloud/deploy.sh created, including the bucket with all
# photos, drafts, and packages in it. Usage: cloud/teardown.sh [--yes]
set -euo pipefail
cd "$(dirname "$0")/.."
source cloud/config.sh

if [ "${1:-}" != "--yes" ]; then
  read -r -p "Delete the agents and gs://$BUCKET with all files in project $PROJECT? Type yes: " answer
  [ "$answer" = yes ] || exit 1
fi

# Runs a delete and goes on when the resource is already gone.
remove() {
  run "$@" || echo "(skipped)"
}

remove gcloud eventarc triggers delete "$TRIGGER" --project="$PROJECT" --location="$REGION" --quiet
remove gcloud workflows delete "$WORKFLOW" --project="$PROJECT" --location="$REGION" --quiet
remove gcloud run services delete "$SERVICE" --project="$PROJECT" --region="$REGION" --quiet
remove gcloud artifacts repositories delete "$REPOSITORY" --project="$PROJECT" --location="$REGION" --quiet
remove gcloud secrets delete "$SECRET" --project="$PROJECT" --quiet
remove gcloud storage rm --recursive "gs://$BUCKET" --project="$PROJECT"

# Project roles first: deleting an account leaves its roles behind as "deleted:" members.
remove gcloud projects remove-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$BUILD_SA" --role=roles/run.builder --condition=None --format=none
for role in roles/eventarc.eventReceiver roles/workflows.invoker roles/logging.logWriter; do
  remove gcloud projects remove-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$EVENTS_SA" --role="$role" --condition=None --format=none
done
for account in "$AGENTS_SA" "$EVENTS_SA" "$BUILD_SA"; do
  remove gcloud iam service-accounts delete "$account" --project="$PROJECT" --quiet
done

cat <<NOTE

Left in place on purpose:
- The role roles/pubsub.publisher of the Cloud Storage service agent. Every Eventarc trigger on
  a bucket in this project needs it. Remove it with:
  gcloud projects remove-iam-policy-binding $PROJECT --condition=None \\
    --member=serviceAccount:\$(gcloud storage service-agent --project=$PROJECT) --role=roles/pubsub.publisher
- The bucket gs://run-sources-$PROJECT-$REGION, where gcloud uploads the source of every
  deploy from source in this region. Delete it with:
  gcloud storage rm --recursive gs://run-sources-$PROJECT-$REGION
- The enabled APIs. They cost nothing while nothing uses them.
NOTE
