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

## Consequences

- `AGENTS.md` states decisions 1, 2, and 5 as rules.
- The chapter 1 spec is rewritten for decision 3 and 4, and chapter 1 gets a
  new release.
- The chapter 2 spec is rewritten from scratch. Its price rule follows
  decision 5.
- Not decided yet, recommended for the chapter 2 spec: `scripts/run-agent.ts`
  reports an event that carries `errorCode` or `errorMessage`, so that a
  failed model call does not look like a successful run.
