# Chapter 4: The Agents in Google Cloud

## What you need

- Chapters 1 to 3. This starter contains their reference solutions, so you
  can start here with or without your own.
- Node.js 26 or newer, npm, and your `GEMINI_API_KEY` in `.env`.
- The [Google Cloud CLI](https://cloud.google.com/sdk/docs/install),
  `gcloud`, logged in with `gcloud auth login`.
- A Google Cloud project with billing turned on, set with
  `gcloud config set project <your-project-id>`. You need the role Owner on
  it, or enough rights to enable APIs, create service accounts, and grant
  roles. A project of your own for this tutorial is the easiest way.
- No Docker. Cloud Build builds the image in the cloud.

## Goal

Until now the agents ran on your machine, started by you. In this chapter
they run in Google Cloud, started by a file:

1. You upload a photo to a Cloud Storage bucket.
2. The listing agent from chapter 2 writes a draft beside it.
3. You download the draft, check it, set `status: freigegeben`, and upload
   it again.
4. The publisher agent from chapter 3 writes the ready-to-post package
   beside it.

No machine of yours stays on, and nothing runs while nothing is uploaded.
The agents are the same code as in chapter 3. What is new is everything
around them, and you will know every piece of it: what it is, why it is
there, which command creates it, and how to remove it again.

The terms this chapter uses:

- **ADK's API server** is the dev tool `adk api_server`. It serves every
  agent in a folder over HTTP: one call creates a session with a state, the
  next runs an agent in it. `adk web` from chapter 2 is the same server with
  a web UI on top.
- **Cloud Run** runs a container image as a web service. It starts the
  container when a request comes in and stops it when none has come for a
  while, so an idle service costs nothing.
- A **Cloud Storage volume** makes a bucket appear as a folder in the
  container. The agents keep reading and writing files, as on your machine.
- **Eventarc** turns something that happened in Google Cloud, here a file
  written to the bucket, into an event and delivers it.
- **Workflows** runs a small program written in YAML. Here it receives the
  event, decides which agent the file is for, and calls the API server.
- A **service account** is an identity for a program, not for a person. Each
  piece gets its own and is given only the roles it needs.
- **Secret Manager** stores your Gemini API key. Cloud Run hands it to the
  container as the variable `GEMINI_API_KEY`, so it is never in the image.

```
you ── upload ──▶ bucket <project>-ka-listings ◀── mounted at /mnt/listings ──┐
                     │ "file written"                                         │
                     ▼                                                        │
                  Eventarc trigger ka-listings                                │
                     │                                                        │
                     ▼                                                        │
                  workflow ka-listings (cloud/workflow.yaml)                  │
                     │ 1. which agent?  2. create session  3. run             │
                     ▼                                                        │
                  Cloud Run service ka-agents: adk api_server adk ────────────┘
                     listing_agent · publisher_agent · …   ── Gemini API, with your key
```

## How you work in this chapter

Five scripts in `cloud/` do everything. Each prints every `gcloud` command
before it runs it, so you see what happens. The section "Everything this
chapter creates in Google Cloud" below has the same commands, one by one,
with the reason for each.

```sh
cloud/setup.sh                              # once: APIs, bucket, secret, accounts, roles
cloud/deploy.sh                             # build and deploy; again after every change
cloud/upload.sh examples/photos/game-boy.jpg  # upload a file and show what the agents did
cloud/teardown.sh                           # delete everything again
```

All names and the region are in `cloud/config.sh`. The region is
`europe-west1`; change it there if you want another.

Before you deploy, `npm run test:offline` checks your work on your machine,
without the cloud and without an API key. It starts your Dockerfile's
command and runs your workflow file with a small interpreter for the
Workflows language, `scripts/support/workflow-interpreter.ts`. Google offers
no local emulator for Workflows, so the interpreter knows only the part of
the language that this workflow needs. `gcloud workflows deploy` checks the
real syntax when you deploy.

## What is already there

- `Dockerfile`: the image for Cloud Run, all but its last line.
- `.gcloudignore`: what `gcloud` leaves out of the upload. `.env` is in it.
- `cloud/config.sh`, `setup.sh`, `deploy.sh`, `upload.sh`, `teardown.sh`.
- `cloud/workflow.yaml`: the workflow, without the steps that choose the
  agent and call it.
- `scripts/test-offline-chapter-04.ts` and
  `scripts/support/workflow-interpreter.ts`.

## Your tasks

Each task is marked as `# TODO(ch04-k)`. Delete the comment when the task is
done.

| Task     | File                  | What to do                                                                                                                                                       |
| -------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ch04-1` | `Dockerfile`          | The `CMD`: start ADK's API server for the agents in `adk/`, reachable from outside the container, on the port in `$PORT`.                                        |
| `ch04-2` | `cloud/workflow.yaml` | The step `choose_agent`: a photo goes to `listing_agent` with its path as `photo_path`, a draft to `publisher_agent` as `draft_path`, anything else to `ignore`. |
| `ch04-3` | `cloud/workflow.yaml` | The steps `create_session` and `run_agent`: create a session with the state, then run the agent in it, both calls with an OIDC token.                            |

Four things to know before you start:

- **The server is the dev tool you already know.** You write no server
  code. `adk api_server adk` serves the four agents in `adk/`, as
  `adk web adk` did. Cloud Run tells the container its port in `$PORT`, and
  a server that listens only on `127.0.0.1` cannot be reached from outside
  the container.
- **A session carries the path.** The listing agent reads the photo path
  from the state key `photo_path`, the publisher agent the draft path from
  `draft_path` (`src/session-state.ts`). The workflow creates the session
  with that state: `POST /apps/<agent>/users/<user>/sessions/<session>` with
  the body `{"state": {...}}`. Then `POST /run` with the agent, the same
  user and session, and the message. The [API server
  docs](https://adk.dev/runtime/api-server/) show both calls.
- **The bucket is a folder.** The event names the file relative to the
  bucket, such as `photos/game-boy.jpg`. In the container it is
  `/mnt/listings/photos/game-boy.jpg`; the step `init` builds that path as
  `file_path`. Compare file names in lower case: phones write `.JPG`. Use
  `text.match_regex(lower_name, "...")`.
- **Every file starts the workflow, also the agents' own.** The draft the
  listing agent writes starts the publisher agent, whose gate from chapter 3
  answers without a model call. The package it writes starts the workflow
  once more, and that file has to go to `ignore`, or the agents would never
  stop.

## Which Gemini the agents use in the cloud

On your machine the agents call the Gemini API with your key, and you see
their usage in [Google AI Studio](https://aistudio.google.com/). In the
cloud they do the same: the key comes from Secret Manager, and the
Dockerfile sets

```dockerfile
ENV GOOGLE_GENAI_USE_ENTERPRISE=false
```

ADK reads this variable. When it is `true` or `1`, ADK sends every model
call to Vertex AI instead: billed to the Google Cloud project, ignoring your
key, and shown in other places. ADK has its own deploy command,
`adk deploy cloud_run`, and the Dockerfile it writes sets the variable to
`1` without saying so. This chapter does not use that command, for that
reason and because in ADK 2.3.0 it cannot deploy agents that import code
from `src/`. Leave the line as it is. The offline test checks it.

## Everything this chapter creates in Google Cloud

`cloud/setup.sh` and `cloud/deploy.sh` run exactly these commands. You can
also run them yourself, one by one. They use the variables from
`cloud/config.sh`; load them first:

```sh
source cloud/config.sh
```

### 1. The APIs

Each Google Cloud service has an API that is off in a new project.

```sh
gcloud services enable --project="$PROJECT" \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  storage.googleapis.com secretmanager.googleapis.com iam.googleapis.com \
  workflows.googleapis.com workflowexecutions.googleapis.com eventarc.googleapis.com \
  pubsub.googleapis.com logging.googleapis.com
```

| API                               | Why                                                    |
| --------------------------------- | ------------------------------------------------------ |
| `run`                             | Cloud Run runs the agents                              |
| `cloudbuild`                      | builds the image from the Dockerfile                   |
| `artifactregistry`                | stores the image                                       |
| `storage`                         | the bucket                                             |
| `secretmanager`                   | the API key                                            |
| `iam`                             | the service accounts                                   |
| `workflows`, `workflowexecutions` | the workflow and its runs                              |
| `eventarc`                        | the trigger                                            |
| `pubsub`                          | Eventarc delivers Cloud Storage events through Pub/Sub |
| `logging`                         | the logs of every piece                                |

### 2. The bucket

Photos, drafts, and packages live here. Bucket names are global, so the
name starts with your project ID. Uniform access means that only IAM roles
decide who may read and write, not settings on single files.

```sh
gcloud storage buckets create "gs://$BUCKET" --project="$PROJECT" --location="$REGION" \
  --uniform-bucket-level-access
```

### 3. The secret

The key is read from `.env` and passed to `gcloud` through a pipe. It is
never printed, never written to a file, and never part of the image.

```sh
node --env-file-if-exists=.env -e 'process.stdout.write(process.env.GEMINI_API_KEY ?? "")' |
  gcloud secrets create "$SECRET" --project="$PROJECT" --replication-policy=automatic --data-file=-
```

When you have a new key: the same pipe into
`gcloud secrets versions add "$SECRET" --data-file=-`, then `cloud/deploy.sh`.

### 4. The image repository

Artifact Registry stores the images Cloud Build builds.

```sh
gcloud artifacts repositories create "$REPOSITORY" --project="$PROJECT" --location="$REGION" \
  --repository-format=docker
```

### 5. The service accounts

Three programs act in the cloud, and each gets its own identity, so that
each can be given only what it needs.

```sh
gcloud iam service-accounts create ka-agents --project="$PROJECT" --display-name="Kleinanzeigen agent: ka-agents"
gcloud iam service-accounts create ka-events --project="$PROJECT" --display-name="Kleinanzeigen agent: ka-events"
gcloud iam service-accounts create ka-build  --project="$PROJECT" --display-name="Kleinanzeigen agent: ka-build"
```

| Account     | Acts as                                |
| ----------- | -------------------------------------- |
| `ka-agents` | the Cloud Run service: the agents      |
| `ka-events` | the trigger and the workflow           |
| `ka-build`  | Cloud Build, while it builds the image |

### 6. The roles

```sh
# The agents read and write files in the bucket, and read the key.
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:$AGENTS_SA" --role=roles/storage.objectUser
gcloud secrets add-iam-policy-binding "$SECRET" --project="$PROJECT" \
  --member="serviceAccount:$AGENTS_SA" --role=roles/secretmanager.secretAccessor

# The build reads the uploaded source, writes its logs, and pushes the image.
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$BUILD_SA" --role=roles/run.builder --condition=None

# The events account receives the events, starts the workflow, and writes its logs.
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$EVENTS_SA" --role=roles/eventarc.eventReceiver --condition=None
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$EVENTS_SA" --role=roles/workflows.invoker --condition=None
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$EVENTS_SA" --role=roles/logging.logWriter --condition=None

# Cloud Storage itself publishes the events to Pub/Sub, as the project's Cloud Storage
# service agent: an account Google creates for every project.
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:$(gcloud storage service-agent --project="$PROJECT")" \
  --role=roles/pubsub.publisher --condition=None
```

The roles on the bucket and on the secret apply only to them. The others
apply to the whole project, because that is where those services check
them. The last role of the events account, to call the agents, follows in
step 8, once the service exists.

### 7. The Cloud Run service

One command uploads this folder (without what `.gcloudignore` names), has
Cloud Build build the image from the Dockerfile as `ka-build`, pushes it to
your repository, and deploys it:

```sh
gcloud run deploy "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --source=. --image="$IMAGE" \
  --build-service-account="projects/$PROJECT/serviceAccounts/$BUILD_SA" \
  --service-account="$AGENTS_SA" --no-allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=$SECRET:latest" \
  --add-volume="name=listings,type=cloud-storage,bucket=$BUCKET,mount-options=metadata-cache-ttl-secs=0" \
  --add-volume-mount="volume=listings,mount-path=$MOUNT_PATH" \
  --memory=2Gi --max-instances=1
```

| Flag                                      | Why                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `--service-account`                       | the agents act as `ka-agents`, not as the project's default account, which may do far more                                                  |
| `--no-allow-unauthenticated`              | only an account with the role `run.invoker` may call the agents. Anyone else gets 403                                                       |
| `--set-secrets`                           | the key, as the variable `GEMINI_API_KEY`                                                                                                   |
| `--add-volume`, `--add-volume-mount`      | the bucket as the folder `/mnt/listings`                                                                                                    |
| `mount-options=metadata-cache-ttl-secs=0` | the mount would otherwise trust what it knew about a file for 60 seconds, and a draft you approved quickly would be read in its old version |
| `--memory=2Gi`                            | ADK compiles the agents when the server starts. 512 MiB, the default, runs out                                                              |
| `--max-instances=1`                       | the API server keeps sessions in memory. The call that runs an agent must reach the instance that created its session                       |

The first `gcloud run deploy --source` in a region also creates the bucket
`run-sources-<project>-<region>`. That is where `gcloud` uploads your
source for the build.

### 8. The events account may call the agents

```sh
gcloud run services add-iam-policy-binding "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --member="serviceAccount:$EVENTS_SA" --role=roles/run.invoker
```

Roles take a minute or two to apply everywhere. A run right after the first
deploy can fail with 403. Upload the file again a little later.

### 9. The workflow

```sh
SERVICE_URL=$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" \
  --format='value(status.url)')
gcloud workflows deploy "$WORKFLOW" --project="$PROJECT" --location="$REGION" \
  --source=cloud/workflow.yaml --service-account="$EVENTS_SA" \
  --set-env-vars="SERVICE_URL=$SERVICE_URL,MOUNT_PATH=$MOUNT_PATH"
```

The workflow calls the service as `ka-events`. `auth: type: OIDC` in a call
makes Workflows send an identity token of that account, which Cloud Run
checks.

### 10. The trigger

```sh
gcloud eventarc triggers create "$TRIGGER" --project="$PROJECT" --location="$REGION" \
  --destination-workflow="$WORKFLOW" --destination-workflow-location="$REGION" \
  --event-filters=type=google.cloud.storage.object.v1.finalized \
  --event-filters="bucket=$BUCKET" \
  --service-account="$EVENTS_SA"
```

`object.v1.finalized` means: a file was written, new or overwritten. In a
project that has never used Eventarc, this command can fail with
"Permission denied while using the Eventarc Service Agent" for a few
minutes. `cloud/deploy.sh` tries again for up to five minutes.

## Try it

```sh
cloud/upload.sh examples/photos/game-boy.jpg
```

The script uploads the photo to `photos/` in the bucket, waits for the
workflow runs it starts, and prints them: one of `listing_agent` with the
path of the draft, then one of `publisher_agent` that refuses the draft,
because nobody approved it yet. Then approve it:

```sh
source cloud/config.sh
gcloud storage cp "gs://$BUCKET/photos/game-boy.md" /tmp/game-boy.md
# Check the draft, change "status: draft" to "status: freigegeben".
cloud/upload.sh /tmp/game-boy.md
gcloud storage cat "gs://$BUCKET/photos/game-boy.listing.json"
```

Where to look when something goes wrong:

```sh
gcloud workflows executions list "$WORKFLOW" --location="$REGION"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE" --limit=50
```

In the console: Workflows → `ka-listings` → Executions shows every run with
its input and result, and Cloud Run → `ka-agents` → Logs shows the server.

What it costs: everything scales to zero. While nothing runs, the secret
and the files in the bucket cost a few cents a month. An upload of a photo
costs a few model calls on your Gemini key and seconds of Cloud Run.

## Remove everything

```sh
cloud/teardown.sh
```

It asks you to type `yes`, because it also deletes the bucket with every
photo, draft, and package in it. It deletes, in this order: the trigger, the
workflow, the service, the image repository, the secret, the bucket, the
project roles of `ka-build` and `ka-events`, and the three service accounts.
The roles on the bucket, the secret, and the service go with them.

It leaves three things and prints how to remove them:

- the role `roles/pubsub.publisher` of the Cloud Storage service agent: any
  other bucket trigger in the project needs it too,
- gcloud's upload bucket `run-sources-<project>-<region>`, which every
  source deploy in the region shares,
- the enabled APIs, which cost nothing while nothing uses them.

## Check your work

```sh
npm run typecheck
npm run test:offline
```

`test:offline` needs no API key and no cloud. Case 16 starts the `CMD` of
your Dockerfile on this machine and asks the server for its agents. Case 17
runs your workflow for photo, draft, and other file names against a fake of
the server. Case 18 runs it against the real API server from case 16, for a
draft that is not approved, so the publisher's gate answers and no model is
called. On the untouched starter it passes the cases of chapters 1 to 3 and
fails case 16, because the Dockerfile has no `CMD`.

The chapter is done when:

- `npm run typecheck` reports no errors,
- `npm run test:offline` passes,
- `cloud/setup.sh` and `cloud/deploy.sh` end with the service URL,
- `cloud/upload.sh examples/photos/game-boy.jpg` shows a draft from
  `listing_agent` and a refusal from `publisher_agent`, and the approved
  draft gets its `game-boy.listing.json`, and
- `cloud/teardown.sh` has removed it all again.

In Claude Code, ask "is my chapter done?" for a check against each task, with
a hint for whatever is still open. It asks before it runs anything in the
cloud.

## Documentation

- [ADK API server](https://adk.dev/runtime/api-server/)
- [ADK on Cloud Run](https://adk.dev/deploy/cloud-run/)
- [Deploying to Cloud Run from source](https://cloud.google.com/run/docs/deploying-source-code)
- [Cloud Storage volumes on Cloud Run](https://cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts)
- [Secrets on Cloud Run](https://cloud.google.com/run/docs/configuring/services/secrets)
- [Eventarc: Cloud Storage events to Workflows](https://cloud.google.com/eventarc/docs/workflows/route-trigger-cloud-storage)
- [Workflows syntax](https://cloud.google.com/workflows/docs/reference/syntax)
- [Authenticated calls from Workflows](https://cloud.google.com/workflows/docs/authenticate-from-workflow)
- [Service accounts](https://cloud.google.com/iam/docs/service-account-overview)
- [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key)
