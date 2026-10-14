#!/usr/bin/env bash
# Builds the container from this folder, deploys it to Cloud Run, and connects the bucket to it
# through Eventarc and Workflows. Run cloud/setup.sh once before. Run this again after you change
# an agent or cloud/workflow.yaml.
set -euo pipefail
cd "$(dirname "$0")/.."
source cloud/config.sh

# 1. Build the image with Cloud Build from the Dockerfile, push it, and deploy it as a service.
#    --no-allow-unauthenticated: only accounts with the invoker role can call the agents.
#    The volume mounts the bucket, so the agents read and write files under $MOUNT_PATH. Its
#    metadata cache is off, so a draft that a person changed is read in its new version.
#    --max-instances=1: the API server keeps sessions in memory, so every call of one run has
#    to reach the same instance.
run gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" --quiet \
  --source=. --image="$IMAGE" \
  --build-service-account="projects/$PROJECT/serviceAccounts/$BUILD_SA" \
  --service-account="$AGENTS_SA" --no-allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=$SECRET:latest" \
  --add-volume="name=listings,type=cloud-storage,bucket=$BUCKET,mount-options=metadata-cache-ttl-secs=0" \
  --add-volume-mount="volume=listings,mount-path=$MOUNT_PATH" \
  --memory=2Gi --max-instances=1

SERVICE_URL=$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='value(status.url)')

# 2. The events account may call the service.
run gcloud run services add-iam-policy-binding "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --member="serviceAccount:$EVENTS_SA" --role=roles/run.invoker --format=none

# 3. The workflow that picks the agent for a file and calls the service.
run gcloud workflows deploy "$WORKFLOW" --project="$PROJECT" --location="$REGION" \
  --source=cloud/workflow.yaml --service-account="$EVENTS_SA" \
  --set-env-vars="SERVICE_URL=$SERVICE_URL,MOUNT_PATH=$MOUNT_PATH" --format=none

# 4. The trigger: every new or overwritten file in the bucket starts the workflow.
#    Right after setup, Eventarc's own service agent may not have its permissions yet. Then the
#    command fails with "Permission denied while using the Eventarc Service Agent", and is retried.
if ! gcloud eventarc triggers describe "$TRIGGER" --project="$PROJECT" --location="$REGION" >/dev/null 2>&1; then
  for attempt in 1 2 3 4 5 6; do
    if run gcloud eventarc triggers create "$TRIGGER" --project="$PROJECT" --location="$REGION" \
      --destination-workflow="$WORKFLOW" --destination-workflow-location="$REGION" \
      --event-filters=type=google.cloud.storage.object.v1.finalized \
      --event-filters="bucket=$BUCKET" \
      --service-account="$EVENTS_SA"; then
      break
    fi
    [ "$attempt" -lt 6 ] || exit 1
    echo "Retrying in 60 seconds ($attempt of 5)."
    sleep 60
  done
fi

echo
echo "Deployed. The agents run at $SERVICE_URL"
echo "Next: cloud/upload.sh examples/photos/game-boy.jpg"
echo "A new role takes a minute or two to apply. If the first run fails with 403 Forbidden,"
echo "upload the file again a little later."
