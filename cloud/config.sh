# The names and places of everything chapter 4 creates in Google Cloud.
# Every script in cloud/ reads this file. Set PROJECT and REGION in your shell to override them.

PROJECT=${PROJECT:-$(gcloud config get-value project 2>/dev/null)}
REGION=${REGION:-europe-west1}

if [ -z "$PROJECT" ]; then
  echo "No Google Cloud project. Run: gcloud config set project <your-project-id>" >&2
  exit 1
fi

# Bucket names are global, so the project ID makes this one unique.
BUCKET=$PROJECT-ka-listings
# Where Cloud Run mounts the bucket in the container.
MOUNT_PATH=/mnt/listings
# The folder in the bucket that upload.sh writes to.
UPLOAD_FOLDER=photos

SERVICE=ka-agents
WORKFLOW=ka-listings
TRIGGER=ka-listings
REPOSITORY=ka-agents
# gcloud wants the image named like the service when it builds from source.
IMAGE=$REGION-docker.pkg.dev/$PROJECT/$REPOSITORY/$SERVICE
SECRET=GEMINI_API_KEY

# Three service accounts, one per job, each with only the roles that job needs.
AGENTS_SA=ka-agents@$PROJECT.iam.gserviceaccount.com # runs the agents
EVENTS_SA=ka-events@$PROJECT.iam.gserviceaccount.com # receives the events, runs the workflow
BUILD_SA=ka-build@$PROJECT.iam.gserviceaccount.com   # builds the container image

# Prints a command, then runs it, so that you see every gcloud call.
run() {
  printf '\n+'
  printf ' %q' "$@"
  printf '\n'
  "$@"
}
