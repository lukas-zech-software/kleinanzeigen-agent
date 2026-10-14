# ADR 0001: Model access goes through ADK on `generateContent`

Date: 2026-10-13
Status: accepted
Decided by: Lukas Zech (maintainer)

## Context

On 2026-10-12 the chapter 2 spec was changed to use the Gemini Interactions
API through ADK's `useInteractionsApi` flag. The change followed a guideline
in `AGENTS.md` that came from the `gemini-api-dev` skill. That skill targets
the `@google/genai` SDK, not ADK.

The plan was executed up to the first live run. The run failed silently: one
event with `400 Invalid JSON payload: syntax error in request body.`, no tool
call, no draft, exit code 0. Evidence:
the debugging sample of 2026-10-12, kept in the maintainer's branch.

On 2026-10-13 the mechanisms for an ADK-only design were probed against the
live API before any spec was rewritten. Evidence:
the probe run of 2026-10-13, kept in the maintainer's branch.

## Decisions

### 1. No Interactions API

The project does not use the Gemini Interactions API, in ADK or anywhere else,
until the maintainer lifts this ban by hand.

Reasons:

- adk.dev documents the Interactions API for ADK Python only. The TypeScript
  flag exists in the package and has no documentation.
- ADK 2.2.1 sends a tool's parameters to the Interactions API in the schema
  dialect of `generateContent` (`"type": "STRING"`). The Interactions API
  documents JSON Schema there.
- It is an API for stateful conversations. The listing agent runs one task
  and holds no conversation, so it gains nothing.
- It stores every interaction on Google's side by default.

One caveat about the evidence: the failing request of 2026-10-12 also
contained `exclusiveMinimum: true`. The probe run showed that the
`generateContent` path rejects that field too (decision 5). So the failed run
does not prove which field the Interactions API rejected. The ban rests on
the four reasons above, not on that error alone.

### 2. No Gemini API calls through `@google/genai`

ADK is the only layer that calls the model. The project does not create a
`GoogleGenAI` client and does not call `models.generateContent` or
`interactions` itself.

Types and helpers come from `@google/adk`. ADK 2.2.1 re-exports no genai
types, but a message written inline in `runner.runAsync({ newMessage: … })`
or pushed onto `request.contents` is typed by ADK's own signatures. An import
from `@google/genai` is an exception: it is allowed only when a value could
not be typed otherwise, and a comment at the import says why.

Reason: two layers with overlapping types caused the confusion in the first
place. ADK's documentation is written for the model name as a string on
`generateContent`, and that is what the project uses.

### 3. Model work is done by agents, combined with `AgentTool`

Chapter 1 builds two specialist agents instead of two function tools that
call the model themselves: a vision agent with an `outputSchema` and a price
agent with `GOOGLE_SEARCH`. Chapter 2 combines them through `AgentTool`.

Reasons:

- `GOOGLE_SEARCH` must be the only tool of its agent in ADK TypeScript.
  adk.dev documents `AgentTool` as the way to use such an agent beside other
  tools.
- Probe `compose`, attempt 2: a root agent called both agents through
  `AgentTool` and a `FunctionTool`, in order, on the first try.

### 4. The photo reaches the vision agent through a callback and the state

`AgentTool` passes only text to the wrapped agent. The vision agent therefore
has a before-model callback that reads `photo_path` from the session state,
loads the file, and adds the image to the request. The model never supplies a
file path.

Reasons:

- Probe `vision`: the callback works on a standalone agent.
- Probe `compose`, attempt 2: it also works behind `AgentTool`, because
  `AgentTool` copies the parent's state into the wrapped agent's run.

### 5. Zod constraints that ADK cannot send

A schema that reaches the model (tool parameters, `outputSchema`) must not
use `.positive()`, `.gt()`, or `.lt()`.

Reason: ADK converts them to `exclusiveMinimum: true` or
`exclusiveMaximum: true`, and the Gemini API answers `400 … Unknown name
"exclusiveMinimum"` (probe `compose`, attempt 1). The request fails before
any tool runs.

Verified to work: `z.string().min(1)`, `z.number().min(0.01)`, `z.enum`,
`z.array`, `.describe()`. Emitted without an exclusive field and therefore
expected to work, not yet run: `.max()`, `.nonnegative()`, `.int()`.

Consequence: a rule such as "the price is positive" is written as
`.min(0.01)`, or it is checked in code after the model call.

### 6. No `outputSchema` on an agent that uses `GOOGLE_SEARCH`

Reason: ADK adds a function declaration to enforce the schema, and the API
rejects a built-in tool beside function calling: `400 Please enable
tool_config.include_server_side_tool_invocations …` (probe `search-schema`).
The price agent answers with JSON as text, and code validates it.

### 7. A search must be proven, not assumed

`GOOGLE_SEARCH` works through ADK on the `generateContent` path, but the
model decides whether it searches. Whether it did is read from
`event.groundingMetadata.webSearchQueries`.

Reasons:

- Probes `search-proof-fresh` and `search-proof-price`: asked in a full
  sentence, the agent searched. The events carry the queries and the sources.
- Probes `search` and `search-strict`: given only "Nintendo Game Boy Classic
  DMG-01, condition: used" and told to answer with only a JSON object, the
  agent did not search, even when the instruction demanded it. It answered
  from memory with a plausible price.

Consequence: the price agent's instruction and input are written so that it
searches, and the check for chapter 1 reads the search queries from the
event. A plausible price is not proof.

## Findings while the chapter 1 plan was written

Found on 2026-10-13 by running the plan's code offline, before the plan was
handed over:

- `GOOGLE_SEARCH` refuses a model whose name does not start with `gemini-`,
  and the model registry resolves every such name to the real Gemini class.
  A stand-in model for an offline test is therefore given to the agent as an
  object (`agent.model = …`), not registered under a name.
- ADK reports an error thrown in a before-model callback as an event with
  `errorCode: UNKNOWN_ERROR` and the message, the same way it reports a
  failed model call. Code that reads events must check for it.
- ADK creates the model before it calls the callback. Without an API key a
  run stops with ADK's message about the key, not with the callback's error.
- The price schema is not sent to the model, because the price agent has no
  output schema. Decision 5 applies to the vision schema and to tool
  parameters, not to it.

## Findings for chapter 2

Found on 2026-10-13, first offline with the scripted model and then in three
live runs of the chapter 2 reference solution:

- **A failed sub-agent is an empty result.** When the run of an agent behind
  `AgentTool` ends in an error event, `AgentTool` returns an empty string.
  The calling agent sees `{"result": ""}` and no error. Its instruction has
  to say what to do then. In the live run with a missing photo the agent
  stopped and said that `vision_inspector` returned nothing.
- **State flows back through `AgentTool`.** A value the wrapped agent writes
  into the session state appears in the calling agent's state and in the
  session file. The price agent uses this to hand back its search queries.
- **A sub-agent's events are not in the caller's session.** `AgentTool` runs
  the wrapped agent in a session of its own. The saved session of the listing
  agent shows the call and its result, and nothing of what happened inside.
- **`adk run --log_level` does not silence the agent's ADK.** The CLI sets
  the level on its own copy of ADK, and the agent file loads another one. The
  level is set in the agent's entry file with `setLogLevel`.
- **`adk run --replay --save_session` is a complete non-interactive run.** It
  takes the state and the query from a file and writes every event and the
  final state to `<session_id>.session.json` beside the agent file. On the
  console it prints the final answer and errors, and no tool calls.

## ADK 2.3.0 and chapter 3

Checked on 2026-10-14 against `@google/adk` 2.3.0, first offline and then in
two live runs of the chapter 3 reference solution.

### 8. Evals run through `runEvals`, not through `adk eval`

`adk eval` is ADK's command for evaluating an agent. In 2.3.0 it cannot load
an agent file: its loader passes a `file://` URL to `require`, and that fails
for a TypeScript file, an ESM file, and a CommonJS file alike. The function
behind the command, `runEvals`, is exported by `@google/adk` and works.
`scripts/run-evals.ts` calls it with the eval set file and the config file
the command would take. When a later ADK release loads agent files, the
script is replaced by the command.

### 9. Evals only where the tool arguments are fixed

`runEvals` scores a tool trajectory by exact equality of the tool names and
of the tool arguments. The listing agent of chapter 2 writes its arguments
freely (a question, a listing text), so no live run can match an expected
trajectory. Chapter 2 keeps `session:check`, which compares names and order.
The publisher agent of chapter 3 has one tool without arguments, so its
trajectories are exact, and chapter 3 uses the eval runner.

### 10. A rule the agent must never break is code, not instruction

The publisher agent must not act on a draft no person has approved. A
before-agent callback reads the draft and answers itself when the status is
not `freigegeben`. The model is not called, so it cannot be talked out of the
rule. The eval case for this passes without a model call.

### What 2.3.0 did not change

- `.positive()`, `.gt()`, and `.lt()` still become `exclusiveMinimum` or
  `exclusiveMaximum` (decision 5).
- `adk run --log_level` still does not reach the ADK copy of the agent file.
  The CLI itself now prints an INFO line when it finds no `.env` beside the
  agent, so the npm scripts pass `--log_level warn` as well: the entry file
  sets the level for the agent, the option for the CLI.
- An agent behind `AgentTool` that fails still returns an empty result.

### Limits of the eval runner

- A run that ends in an error event has no tool call. A case that expects no
  tool call therefore passes when the agent is broken. An eval set needs
  cases that expect a call.
- The runner does not set the process exit code. `scripts/run-evals.ts`
  exits with 1 when a case failed.

### Dependencies

`@google/adk-devtools` pulls in `tedious` through `@mikro-orm/mssql`, and
`tedious` 20.0.0 depended on `sprintf-js`, which has an open advisory and no
fixed release. `package.json` overrides `tedious` to `^20.3.7`, which does
not use `sprintf-js`. Four high-severity findings remain through `braces`
(via `fast-glob`), for which no fixed release exists either. They concern the
dev tools, not the tutorial's code.

## Chapter 4: Cloud Run

Checked on 2026-10-14 in a Google Cloud project, region `europe-west1`, with
ADK 2.3.0 and `gcloud` 575.0.0: first piece by piece, then from a clean
project with the chapter's scripts. The evidence is in
`docs/debugging/2026-10-14-chapter-04-cloud/` on the maintainer branch.

### 11. Our own Dockerfile, not `adk deploy cloud_run`

ADK's deploy command bundles each agent file with esbuild and copies only the
bundles. The API server in its container bundles them again, and every agent
fails to load with "Identifier 'Module' has already been declared":
`/list-apps` answers `[]`. Its pass-through of `gcloud` flags is broken as
well: the agent path and `--` are passed on to `gcloud`, and without them the
first unknown flag is taken as the agents folder. Its Dockerfile installs
`@google/adk-devtools@latest`, not the project's version.

The chapter's `Dockerfile` installs the locked dependencies with `npm ci`
and runs `npx adk api_server adk`, the same dev tool as `adk web`.
`gcloud run deploy --source` builds it with Cloud Build. ADK compiles the
agents when the server starts, which needs more than the default 512 MiB;
the service gets 2 GiB.

### 12. In the cloud the agents use the Gemini API key, not Vertex AI

The Dockerfile that `adk deploy cloud_run` writes sets
`GOOGLE_GENAI_USE_ENTERPRISE=1`, `GOOGLE_CLOUD_PROJECT`, and
`GOOGLE_CLOUD_LOCATION`. With that variable true, ADK's Gemini model calls
Vertex AI, billed to the Cloud project, and ignores `GEMINI_API_KEY`
(`isEnterpriseModeEnabled` in `utils/env_aware_utils.js`, `geminiInitParams`
in `models/google_llm.js`). The command does not say so.

The maintainer decided that the deployed agents keep using the Gemini API
key, so that their token usage and cost stay where they are watched. The key
is a Secret Manager secret that Cloud Run passes as `GEMINI_API_KEY`, and the
Dockerfile sets `GOOGLE_GENAI_USE_ENTERPRISE=false`. The offline test of
chapter 4 fails when that line changes. The Vertex AI API was not enabled in
the probe project, so the successful runs there went through the Gemini API.

### 13. A workflow calls ADK's API server; no server code of our own

Eventarc delivers each file written to the bucket to a workflow. The workflow
picks the agent by the file name, creates a session with the path in its
state, and calls `/run`. One Cloud Run service serves all agents.

- The API server keeps sessions in memory, so the service runs with
  `--max-instances=1`: the call that runs an agent must reach the instance
  that created its session.
- The bucket is a Cloud Storage volume at `/mnt/listings`, so the agents keep
  their file paths. The exclusive create of the draft (`wx`) works on it.
  The mount caches file metadata for 60 seconds, and a draft approved within
  that time was read in its old version; the volume is mounted with
  `metadata-cache-ttl-secs=0`.
- The agents' own files start the workflow too. The publisher's gate stops a
  draft no person approved before any model call, and the workflow ignores
  the package.

### What else the probes showed

- IAM is eventually consistent. The first run, a minute after the events
  account got `roles/run.invoker`, was refused with 403; the same upload a
  minute later worked. The first Eventarc trigger in a project can fail with
  "Permission denied while using the Eventarc Service Agent" for a few
  minutes; `cloud/deploy.sh` retries.
- `gcloud run deploy --source` creates the bucket
  `run-sources-<project>-<region>` for the upload, and without `--image` an
  Artifact Registry repository `cloud-run-source-deploy`. The chapter creates
  its own repository and names the bucket in its teardown.

## Consequences

- `AGENTS.md` states decisions 1, 2, and 5 as rules.
- The chapter 1 spec is rewritten for decision 3 and 4, and chapter 1 gets a
  new release.
- The chapter 2 spec is rewritten from scratch. Its price rule follows
  decision 5.
- Not decided yet, recommended for the chapter 2 spec: `scripts/run-agent.ts`
  reports an event that carries `errorCode` or `errorMessage`, so that a
  failed model call does not look like a successful run.
- Chapter 4 deploys with its own `Dockerfile` and `cloud/deploy.sh`. The
  `adk-typescript` skill names decisions 11 and 12 as limits, and the offline
  test of chapter 4 enforces decision 12.
