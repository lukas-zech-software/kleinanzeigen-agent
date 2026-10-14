# Chapter 4: the agents in Google Cloud, started by storage events

Date: 2026-10-14
Status: approved 2026-10-14 by the maintainer's standing instruction to
publish the remaining chapters ("Just follow the score"), and their
instruction for chapter 4: every API, resource, service account, and role is
named in the chapter with the `gcloud` command that creates it. The
maintainer also decided during the probes that the agents in the cloud use
the Gemini API key, not Vertex AI (see "Gemini backend").

## Purpose

After chapter 4 the learner can run the agents of chapters 1 to 3 in Google
Cloud without a machine that stays on: a photo uploaded to a bucket becomes
a draft, and a draft uploaded with `status: freigegeben` becomes the
ready-to-post package. They know every piece of Google Cloud that this takes
and why it is there, and they can remove all of it again.

Release `v6`, the last chapter of the roadmap.

## What the probes showed

Run on 2026-10-14 in the project `lukas-gcloud-playground`, region
`europe-west1`, with ADK 2.3.0 and `gcloud` 575.0.0. Evidence:
`docs/debugging/2026-10-14-chapter-04-cloud/` (logs, and the reference files
under `reference/`).

1. **`adk deploy cloud_run` cannot deploy these agents.** It bundles each
   agent file with esbuild and copies only the bundles. The API server in
   its container bundles them again, and every agent fails to load with
   "Identifier 'Module' has already been declared"; `/list-apps` answers `[]`.
   Its gcloud pass-through is broken too: everything after the fifth
   argument, including the agent path and `--`, goes to gcloud, and the first
   unknown flag is taken as the agents folder. Its Dockerfile installs
   `@google/adk-devtools@latest`, not the version of the project.
2. **`adk deploy cloud_run` switches the agents to Vertex AI.** Its
   Dockerfile sets `GOOGLE_GENAI_USE_ENTERPRISE=1`, `GOOGLE_CLOUD_PROJECT`,
   and `GOOGLE_CLOUD_LOCATION`. ADK's Gemini model then calls Vertex AI,
   billed to the Cloud project, and ignores `GEMINI_API_KEY`. Nothing in the
   command's output says so. (`env_aware_utils.js`, `isEnterpriseModeEnabled`;
   `google_llm.js`, `geminiInitParams`.)
3. **Our own Dockerfile and `gcloud run deploy --source` work.** The image
   runs `npx adk api_server adk` with the project's exact dependencies, and
   all four agents load. The default 512 MiB ran out of memory while ADK
   compiled the agents; 2 GiB is enough.
4. **The Gemini API key reaches the agents from Secret Manager.**
   `--set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest`, with
   `GOOGLE_GENAI_USE_ENTERPRISE=false` in the Dockerfile. The Vertex AI API
   was not enabled in the project, so the successful runs went through the
   Gemini API.
5. **A Cloud Storage volume keeps the file paths.** The bucket is mounted at
   `/mnt/listings`. The agents read the photo, write the draft with the
   exclusive `wx` flag, and write the package, all through the mount.
6. **The mount caches metadata for 60 seconds.** A draft approved and
   uploaded within a minute of the last read was read in its old version.
   `mount-options=metadata-cache-ttl-secs=0` fixes it; the second probe
   approved a draft seconds after the agent wrote it.
7. **Eventarc → Workflows → API server works.** The workflow creates a
   session with the path in its state, then calls `/run`. A photo starts
   `listing_agent`. The draft it writes starts `publisher_agent`, whose gate
   answers without a model call. An approved draft gets a package. The
   package starts the workflow once more, which ignores it.
8. **IAM is eventually consistent.** The first run, about a minute after
   `roles/run.invoker` was granted, got 403 "lacks run.routes.invoke". The
   same upload a minute later worked. The first trigger creation in a
   project can fail with "Permission denied while using the Eventarc Service
   Agent"; it worked on the second try 45 seconds later.
9. **`gcloud run deploy --source` creates resources of its own** unless told
   otherwise: an Artifact Registry repository `cloud-run-source-deploy` and
   the bucket `run-sources-<project>-<region>`. With `--image` pointing to a
   repository we create, only the bucket remains; it is gcloud's upload area
   and is shared by every source deploy in the region.
10. **The API server keeps sessions in memory.** A session created by one
    request must be found by the next. `--max-instances=1` guarantees that.

## Decisions

| Topic | Decision |
|---|---|
| Deploy | Our own `Dockerfile` and `.gcloudignore`, built by Cloud Build through `gcloud run deploy --source=. --image=…`. Not `adk deploy cloud_run` (finding 1) |
| Server | ADK's API server, `adk api_server adk`, the dev tool of chapters 2 and 3. No server code |
| Gemini backend | The Gemini API key, from Secret Manager. `ENV GOOGLE_GENAI_USE_ENTERPRISE=false` in the Dockerfile, with a comment that says why (finding 2). The chapter says what `adk deploy` would have changed |
| Services | One Cloud Run service `ka-agents` with all agents in `adk/`, private (`--no-allow-unauthenticated`), scales to zero, `--max-instances=1`, 2 GiB |
| Files | The bucket `<project>-ka-listings`, mounted at `/mnt/listings` with the metadata cache off. The agents keep their file paths |
| Events | One Eventarc trigger on `google.cloud.storage.object.v1.finalized` for the bucket, with a workflow as destination |
| Glue | Cloud Workflows, `cloud/workflow.yaml`: picks the agent by file type, creates a session with the path in the state, calls `/run`, returns the answer, fails on an error event |
| Accounts | `ka-agents` (runs the agents), `ka-events` (trigger and workflow), `ka-build` (Cloud Build). Each with only its roles |
| Image | Artifact Registry repository `ka-agents`, image `ka-agents` |
| Scripts | `cloud/config.sh`, `setup.sh`, `deploy.sh`, `upload.sh`, `teardown.sh`. Each prints every `gcloud` command before it runs it |
| Offline test | `scripts/test-offline-chapter-04.ts` starts the Dockerfile's `CMD` on this machine without an API key and runs `cloud/workflow.yaml` with a small interpreter for the Workflows language, `scripts/support/workflow-interpreter.ts` |
| Region | `europe-west1`, changeable in `cloud/config.sh` |

## Everything the chapter creates

The chapter text lists each of these with its command, in this order, and
`cloud/setup.sh` and `cloud/deploy.sh` run the same commands.

| What | Name | Created by |
|---|---|---|
| APIs | `run`, `cloudbuild`, `artifactregistry`, `storage`, `secretmanager`, `iam`, `workflows`, `workflowexecutions`, `eventarc`, `pubsub`, `logging` | `gcloud services enable` |
| Bucket | `<project>-ka-listings`, uniform access, in the region | `gcloud storage buckets create` |
| Secret | `GEMINI_API_KEY`, automatic replication, value piped from `.env` | `gcloud secrets create --data-file=-` |
| Repository | `ka-agents`, Docker, in the region | `gcloud artifacts repositories create` |
| Service accounts | `ka-agents`, `ka-events`, `ka-build` | `gcloud iam service-accounts create` |
| Roles of `ka-agents` | `roles/storage.objectUser` on the bucket, `roles/secretmanager.secretAccessor` on the secret | `add-iam-policy-binding` on each |
| Role of `ka-build` | `roles/run.builder` on the project | `gcloud projects add-iam-policy-binding` |
| Roles of `ka-events` | `roles/eventarc.eventReceiver`, `roles/workflows.invoker`, `roles/logging.logWriter` on the project; `roles/run.invoker` on the service | project binding; `gcloud run services add-iam-policy-binding` |
| Role of the Cloud Storage service agent | `roles/pubsub.publisher` on the project | `gcloud projects add-iam-policy-binding` |
| Cloud Run service | `ka-agents` | `gcloud run deploy --source` |
| Workflow | `ka-listings`, with `SERVICE_URL` and `MOUNT_PATH` | `gcloud workflows deploy` |
| Trigger | `ka-listings` | `gcloud eventarc triggers create` |
| Created by gcloud itself | the bucket `run-sources-<project>-<region>` | the first `gcloud run deploy --source` |

`cloud/teardown.sh` deletes all of it in reverse order, after the learner
types `yes` (or with `--yes`). It leaves three things and prints how to
remove them: the role of the Cloud Storage service agent (every bucket
trigger in the project needs it), gcloud's `run-sources-…` bucket, and the
enabled APIs.

Costs: everything scales to zero. While nothing runs, the secret and the
stored files cost cents per month. Each upload of a photo costs a few model
calls on the learner's Gemini key and a few seconds of Cloud Run.

## `chapter-04-starter`

Built on `chapter-03-solution`.

| File | State |
|---|---|
| `Dockerfile` | Provided except the `CMD`: `# TODO(ch04-1)` |
| `.gcloudignore` | Provided |
| `cloud/config.sh`, `setup.sh`, `deploy.sh`, `upload.sh`, `teardown.sh` | Provided |
| `cloud/workflow.yaml` | Provided except two steps: `# TODO(ch04-2)` in place of `choose_agent`, `# TODO(ch04-3)` in place of `create_session` and `run_agent`. The steps `init`, `ignore`, `check_last_event`, `check_error`, `collect_answer`, `join_text_parts`, and `report` are provided |
| `scripts/support/workflow-interpreter.ts` | Provided |
| `scripts/test-offline-chapter-04.ts` | Provided |
| `package.json` | `test:offline` gets `&& tsx scripts/test-offline-chapter-04.ts` |
| `.tutorial/chapter`, `CURRENT_CHAPTER.md` | `04`, and the chapter text |

On the untouched starter, `npm run test:offline` passes chapters 1 to 3 and
fails case 16: the Dockerfile has no `CMD`.

### Learner tasks

| Task | File | What to do |
|---|---|---|
| `ch04-1` | `Dockerfile` | The `CMD`: start ADK's API server for the agents in `adk/`, on `0.0.0.0` and the port in `$PORT` |
| `ch04-2` | `cloud/workflow.yaml` | The step `choose_agent`: a photo (`.jpg`, `.jpeg`, `.png`, in any case) goes to `listing_agent` with `photo_path` in the state; a draft (`.md`) goes to `publisher_agent` with `draft_path`; anything else goes to `ignore` |
| `ch04-3` | `cloud/workflow.yaml` | The steps `create_session` and `run_agent`: the two calls of the API server, both with an OIDC token, the same user and session, and the result in `run` |

The learner's step names may differ, as long as the provided steps find
`app`, `state`, `message`, and `run`.

### `scripts/test-offline-chapter-04.ts` (provided)

No API key, no cloud, no quota.

16. The Dockerfile keeps `GOOGLE_GENAI_USE_ENTERPRISE=false`, puts no key
    into the image, and its `CMD`, started on this machine with `PORT` set,
    serves the four agents on `0.0.0.0` and that port.
17. The workflow, run by the interpreter against a recording fake: each
    photo name creates a session of `listing_agent` with the photo path in
    the state and runs it with a text message; a draft does the same for
    `publisher_agent`; `.listing.json`, `.txt`, `.md.bak`, and a folder start
    nothing; the answer is returned; an error event fails the workflow.
18. The workflow against the API server from case 16, for
    `examples/drafts/not-approved.md`: both calls carry OIDC, and the answer
    is the publisher's refusal from its gate.

Nine deliberate mistakes were each caught at the expected case before this
spec was written: `--host=127.0.0.1`, a fixed port, the Vertex AI switch on,
a case-sensitive file match, a wrong state key, `\.md` without `$`, no
`auth`, a different user in the two calls, and swapped agents.

### Chapter 4 criteria

`ch04-1` to `ch04-3` static, `ch04-tc`, `ch04-script` (`npm run
test:offline`), and three live criteria, each run only after the learner
agrees, because they create billable resources:

- `ch04-live-1`: `cloud/setup.sh` and `cloud/deploy.sh` end without an error
  and print the service URL.
- `ch04-live-2`: `cloud/upload.sh examples/photos/game-boy.jpg` shows a
  succeeded run of `listing_agent` that names the draft, then one of
  `publisher_agent` that refuses the unapproved draft. The same script with
  the draft changed to `status: freigegeben` shows a run that names the
  package, and `game-boy.listing.json` is in the bucket.
- `ch04-live-3`: `cloud/teardown.sh` ends, and `gcloud run services list`,
  `gcloud workflows list`, and `gcloud eventarc triggers list` in the region
  no longer show the chapter's resources.

## `chapter-04-solution`

Fills the three TODOs. `git diff chapter-04-starter chapter-04-solution`
touches only `Dockerfile` and `cloud/workflow.yaml`.

## Changes on `main` for chapter 4

- The chapter 4 criteria file; `CHAIN` in `scripts/verify-chain.sh` with nine
  branches, and invariant 3 also searches `cloud` and `Dockerfile`.
- `AGENTS.md`: TODO markers are `// TODO(chNN-k)` in TypeScript and
  `# TODO(chNN-k)` in YAML and the Dockerfile; the cloud scripts create
  billable resources, so an agent asks before it runs `setup.sh`,
  `deploy.sh`, `upload.sh`, or `teardown.sh`; it never prints the secret.
- The `check-chapter` skill: a live criterion that needs the cloud asks
  first, like one that needs the key. The procedure's TODO wording covers
  `#` markers.
- The `adk-typescript` skill: the limits of `adk deploy cloud_run` and the
  Vertex AI switch.
- README (status, table, how to start chapter 4), roadmap (chapter 4
  available, its section rewritten to what was built), `CONTRIBUTING.md`
  chain examples, ADR 0001 section "Chapter 4: Cloud Run", and
  `docs/how-this-was-built.md` with a link to this spec.

## Release

`v6` on all eight chapter branches. Tags never move. No commit on a chain
branch carries a `Claude-Session` line.

## Acceptance criteria

1. `scripts/verify-chain.sh` passes for all nine branches.
2. On `chapter-04-starter`, `npm run test:offline` fails at case 16 with the
   message about the missing `CMD`. On `chapter-04-solution` it passes
   without an API key.
3. From a clean project state, on `chapter-04-solution`: `cloud/setup.sh`,
   `cloud/deploy.sh`, and `cloud/upload.sh` with a photo and then with the
   approved draft produce the draft and the package in the bucket; the runs
   show in `gcloud workflows executions list` and in Cloud Logging;
   `cloud/teardown.sh --yes` removes everything it lists.
4. No chain branch contains `.env`, a key, a plan, or a debugging sample.
5. The eight `v6` tags exist on the remote, and "Verify chain" passes on
   `main`.
