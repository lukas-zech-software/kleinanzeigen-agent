#!/usr/bin/env bash
# Creates what the agents need in Google Cloud, once per project: APIs, the bucket, the secret,
# the image repository, the service accounts, and their roles. Run cloud/deploy.sh afterwards.
# Running it again is safe: what exists already is left as it is, and the key gets a new version.
set -euo pipefail
cd "$(dirname "$0")/.."
source cloud/config.sh

echo "Project: $PROJECT, region: $REGION"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')

# 1. The APIs of the services the chapter uses.
run gcloud services enable --project="$PROJECT" \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  storage.googleapis.com secretmanager.googleapis.com iam.googleapis.com \
  workflows.googleapis.com workflowexecutions.googleapis.com eventarc.googleapis.com \
  pubsub.googleapis.com logging.googleapis.com

# 2. The bucket for photos, drafts, and packages.
if ! gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT" >/dev/null 2>&1; then
  run gcloud storage buckets create "gs://$BUCKET" --project="$PROJECT" --location="$REGION" \
    --uniform-bucket-level-access
fi

# 3. The Gemini API key as a secret. It is read from your environment or from .env and passed
#    to gcloud through a pipe, so it is never printed and never lands in a file or the image.
read_key='process.stdout.write(process.env.GEMINI_API_KEY ?? "")'
key_length=$(node --env-file-if-exists=.env -e 'process.stdout.write(String((process.env.GEMINI_API_KEY ?? "").length))')
if [ "$key_length" -eq 0 ]; then
  echo "GEMINI_API_KEY is not set in your environment or in .env." >&2
  exit 1
fi
if gcloud secrets describe "$SECRET" --project="$PROJECT" >/dev/null 2>&1; then
  echo
  echo "+ <key from .env> | gcloud secrets versions add $SECRET --data-file=-"
  node --env-file-if-exists=.env -e "$read_key" |
    gcloud secrets versions add "$SECRET" --project="$PROJECT" --data-file=-
else
  echo
  echo "+ <key from .env> | gcloud secrets create $SECRET --replication-policy=automatic --data-file=-"
  node --env-file-if-exists=.env -e "$read_key" |
    gcloud secrets create "$SECRET" --project="$PROJECT" --replication-policy=automatic --data-file=-
fi

# 4. The repository for the container image.
if ! gcloud artifacts repositories describe "$REPOSITORY" --project="$PROJECT" --location="$REGION" >/dev/null 2>&1; then
  run gcloud artifacts repositories create "$REPOSITORY" --project="$PROJECT" --location="$REGION" \
    --repository-format=docker
fi

# 5. The three service accounts.
for account in "$AGENTS_SA" "$EVENTS_SA" "$BUILD_SA"; do
  if ! gcloud iam service-accounts describe "$account" --project="$PROJECT" >/dev/null 2>&1; then
    run gcloud iam service-accounts create "${account%%@*}" --project="$PROJECT" \
      --display-name="Kleinanzeigen agent: ${account%%@*}"
  fi
done

# 6. The roles. Adding a role a member already has changes nothing.
#    The agents read and write files in the bucket and read the key.
run gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --project="$PROJECT" \
  --member="serviceAccount:$AGENTS_SA" --role=roles/storage.objectUser --format=none
run gcloud secrets add-iam-policy-binding "$SECRET" --project="$PROJECT" \
  --member="serviceAccount:$AGENTS_SA" --role=roles/secretmanager.secretAccessor --format=none
#    The build reads the uploaded source, writes logs, and pushes the image.
run gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$BUILD_SA" --role=roles/run.builder --condition=None --format=none
#    The events account receives the bucket's events, starts the workflow, and writes its logs.
#    It may call the agents' service too; deploy.sh grants that once the service exists.
for role in roles/eventarc.eventReceiver roles/workflows.invoker roles/logging.logWriter; do
  run gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:$EVENTS_SA" --role="$role" --condition=None --format=none
done
#    Cloud Storage sends its events through Pub/Sub, as the project's Cloud Storage service agent.
STORAGE_AGENT=$(gcloud storage service-agent --project="$PROJECT" | tr -d '[:space:]')
run gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$STORAGE_AGENT" --role=roles/pubsub.publisher --condition=None --format=none

echo
echo "Setup done. Next: cloud/deploy.sh"
