# Chapter 4 criteria: The Agents in Google Cloud

Goal: the agents of chapters 1 to 3 run in Google Cloud. A photo uploaded to
the bucket becomes a draft, and a draft uploaded with `status: freigegeben`
becomes the ready-to-post package, through Eventarc, a workflow, and ADK's
API server on Cloud Run. The learner can remove all of it again.

Script command: `npm run test:offline`
Live test command: `cloud/setup.sh && cloud/deploy.sh`, then
`cloud/upload.sh examples/photos/game-boy.jpg`, then `cloud/teardown.sh`
Live test setup: These commands create resources in the learner's Google
Cloud project that cost money, and they use the Gemini key. Ask before each
of the three steps, and say what it does: setup and deploy create the
resources listed in `CURRENT_CHAPTER.md`; upload runs the agents; teardown
deletes the bucket with every file in it. Instead of a photo path, check that
`gcloud config get-value project` names a project and that
`gcloud auth list` shows an active account. For `ch04-live-2`, after the
first upload, download `photos/game-boy.md` from the bucket to a temp file,
change `status: draft` to `status: freigegeben` only when the learner agrees,
and run `cloud/upload.sh` with that file. Delete the temp file afterwards.
Run `cloud/teardown.sh` only when the learner confirms it; it asks them to
type `yes` themselves.
Required key: `GEMINI_API_KEY`

## ch04-1 The container starts ADK's API server

- Type: static
- Target: `Dockerfile`, its `CMD`
- Requirement: the `CMD` starts `adk api_server` for the agents in `adk/`,
  listening on `0.0.0.0` and on the port in the variable `PORT`. The line
  `ENV GOOGLE_GENAI_USE_ENTERPRISE=false` is still there, and no key is put
  into the image. The `# TODO(ch04-1)` comment is gone.
- Hint: The container runs the same dev tool as `npm run agent:web`, without
  the web UI. Cloud Run decides the port and tells the container in `$PORT`.
  A server that listens on `127.0.0.1` is reachable only from inside its own
  container. In the JSON form of `CMD` no shell expands `$PORT`.
- Docs: https://adk.dev/runtime/api-server/

## ch04-2 The workflow chooses the agent

- Type: static
- Target: `cloud/workflow.yaml`, the step that replaced `# TODO(ch04-2)`
- Requirement: a photo (`.jpg`, `.jpeg`, `.png`, in any case) sets `app` to
  `listing_agent`, `state` to a map with `photo_path` set to `file_path`,
  and `message` to a text. A draft (`.md` at the end of the name) sets
  `publisher_agent` and `draft_path`. Every other file, including
  `.listing.json`, reaches the step `ignore` and starts no agent.
- Hint: The publisher writes a `.listing.json` into the same bucket, and
  that file starts the workflow too. A pattern without `$` at its end also
  matches `game-boy.md.bak`. Compare `lower_name`, not `object_name`: phones
  write `.JPG`.
- Docs: https://cloud.google.com/workflows/docs/reference/syntax/conditions

## ch04-3 The workflow calls the API server

- Type: static
- Target: `cloud/workflow.yaml`, the steps that replaced `# TODO(ch04-3)`
- Requirement: a `http.post` to
  `/apps/<app>/users/<user>/sessions/<session_id>` with the body
  `{state: state}`, then a `http.post` to `/run` with `appName`, the same
  `userId` and `sessionId`, and `newMessage` with the role `user` and one
  text part. Both have `auth` with `type: OIDC`. The response of `/run` is
  stored in `run`.
- Hint: The API server keeps the session that the first call creates, and
  the second call has to name exactly that one, or it answers 404. Without
  an OIDC token Cloud Run answers 403 before the request reaches ADK.
- Docs: https://adk.dev/runtime/api-server/

## ch04-tc Typecheck

- Type: typecheck
- Target: whole project
- Requirement: `npx tsc --noEmit` exits 0.
- Hint: This chapter changes no TypeScript. An error here comes from an
  earlier chapter's code.
- Docs: https://adk.dev/agents/llm-agents/

## ch04-script Offline test

- Type: script
- Target: `scripts/test-offline-chapter-04.ts`
- Requirement: `npm run test:offline` exits 0.
- Hint: The failing assertion names its case. Cases 1 to 15 are chapters 1
  to 3. Case 16 is the Dockerfile and the server it starts, 17 the choice of
  the agent, and 18 the two calls against the real API server.
- Docs: https://cloud.google.com/workflows/docs/reference/syntax

## ch04-live-1 The agents are deployed

- Type: live
- Target: `cloud/setup.sh`, `cloud/deploy.sh`
- Requirement: both scripts exit 0, and `cloud/deploy.sh` ends with
  "Deployed. The agents run at https://…".
- Hint: A 403 or "permission denied" right after setup is often a role that
  has not reached every server yet; run the script again a minute later. An
  error about billing means the project has no billing account.
- Docs: https://cloud.google.com/run/docs/deploying-source-code

## ch04-live-2 A photo becomes a draft, an approved draft a package

- Type: live
- Target: the output of `cloud/upload.sh`, and the bucket
- Requirement: after the photo, a succeeded run of `listing_agent` names
  `photos/game-boy.md`, and a succeeded run of `publisher_agent` refuses the
  draft because it is not approved. After the approved draft, a succeeded
  run of `publisher_agent` names `photos/game-boy.listing.json`, which is in
  the bucket, and a run for that file starts no agent.
- Hint: A failed run with 403 right after the first deploy: upload again a
  minute later. A run of `publisher_agent` that still sees `status: draft`
  after you approved it: check the volume's
  `metadata-cache-ttl-secs=0` in `cloud/deploy.sh`.
- Docs: https://cloud.google.com/eventarc/docs/workflows/route-trigger-cloud-storage

## ch04-live-3 Everything is removed again

- Type: live
- Target: `cloud/teardown.sh`
- Requirement: the script exits 0, and `gcloud run services list`,
  `gcloud workflows list`, and `gcloud eventarc triggers list` for the
  region show none of `ka-agents`, `ka-listings`.
- Hint: The script lists what it leaves in place on purpose and how to
  remove it.
- Docs: https://cloud.google.com/run/docs/managing/services#delete
