# Chapter 2: Listing agent and human review

Date: 2026-10-13
Status: approved 2026-10-13

## Purpose

Chapter 1 gave the learner two specialist agents. Chapter 2 gives them the
agent that uses both: it inspects a photo, researches a price, writes a
listing text, and saves a draft that a person reviews.

After this chapter the learner can combine agents with `AgentTool`, write a
function tool that works with the session state, run and inspect an agent
with ADK's own dev tools, and read what an agent did from a saved session.

This spec replaces the chapter 2 spec of 2026-10-12, which is superseded. It
builds on
[the ADK-only foundation and chapter 1](2026-10-13-adk-only-foundation-chapter-01-design.md)
("spec A") and follows
[ADR 0001](../../adr/0001-model-access-through-adk.md).

## Scope

In scope:

- Branches `chapter-02-starter` and `chapter-02-solution`.
- The chapter 2 criteria and one addition to the `check-chapter` skill.
- The chain of five branches, and the texts on `main` that announce chapter 2.
- One fix on `chapter-01-starter`: the entry files for `adk run` set ADK's log
  level to warnings.
- Release `v4` on all four chapter branches, and the push.

Out of scope:

- A hand-written runner and hand-written event printing. ADK's dev tools run
  the agent and show what it did.
- `adk eval`. It arrives with ADK 2.3.0. This chapter has a small stand-in.
- An overwrite flag for drafts, more than one photo per listing, remote
  storage, and listing rules such as the title length. Chapter 3 enforces the
  rules, and chapter 4 adds a bucket.
- Parsing a draft. That is a chapter 3 task.

## Decisions

| Topic | Decision |
|---|---|
| Composition | One `LlmAgent`, `listing_agent`, with `vision_inspector` and `price_evaluator` behind `AgentTool` and a function tool `create_listing_draft` |
| Running | Only with ADK's dev tools: `adk run` with a replay file and `--save_session`, and `adk web`. The learner writes no runner |
| What the learner reads | The session file `adk run` saves. One task reads the tool calls from it |
| Tool call check | A provided script compares those tool calls with an expected list. It is the stand-in for `adk eval` until ADK 2.3.0 |
| Draft path | The photo path is in the session state. The tool reads it there. The model never supplies a file path |
| Storage | A local Markdown file with YAML frontmatter, beside the photo. Never overwritten |
| Expected tool failures | Returned as `{ status: 'error', message }`, so that the model can report them |
| Price rule | At least 0.01. `listingDraftSchema` holds the rule as `.min(0.01)`, and the tool's input reuses it. `.positive()` cannot be sent to the model (ADR 0001, decision 5) |
| Failed sub-agent | `AgentTool` returns an empty string when the wrapped agent's run fails. The instruction tells the agent to stop on an empty result or an error |
| Search proof | The price agent's events are not in the listing agent's session. A provided after-model callback on the price agent writes its search queries into the session state, and the check requires them |
| Listing language | The learner's choice, set in their instruction. The solution writes German |
| Offline test | The scripted model of spec A, extended by scripted tool calls |

Run live on 2026-10-13 in a scratch copy, after this spec was approved and
before its plan was written: a full run (three tool calls in order, two
search queries, a draft, a passing session check), a second run on the same
photo (the agent reported the existing draft), and a run with a missing photo
(the agent stopped after the empty result of `vision_inspector`).

Run offline with the scripted model before this spec was written: the
listing agent calling both agents through `AgentTool` and then the draft
tool; the photo reaching the wrapped vision agent; `{"result": ""}` as the
result of a wrapped agent that failed; a state value written by the wrapped
price agent appearing on the listing agent's event; and `adk run --replay
--save_session` writing a session file with every event and the final state.

## Architecture

```
npm run agent:listing
  adk run adk/listing_agent.ts --replay examples/replays/listing-agent.json
          --save_session --session_id listing-agent
    └─ listing_agent                      LlmAgent
         ├─ AgentTool(vision_inspector)   reads photo_path from the copied state
         ├─ AgentTool(price_evaluator)    writes price_search_queries to the state
         └─ create_listing_draft          reads photo_path, writes game-boy.md
  → adk/listing-agent.session.json        every event and the final state

npm run session:check                     reads the session file
  └─ toolCallsOf(session)                 the learner's function
```

One run:

1. `adk run` creates a session whose state is the `state` of the replay file,
   `{ "photo_path": "examples/photos/game-boy.jpg" }`, and sends the query.
2. The agent calls `vision_inspector`. `AgentTool` copies the state into the
   wrapped agent's run, and that agent's callback adds the photo.
3. The agent calls `price_evaluator` with a question in a full sentence. The
   wrapped agent searches, and its callback records the search queries in the
   state. `AgentTool` copies that change back.
4. The agent writes the listing text and calls `create_listing_draft`.
5. The agent answers with the path of the draft. `adk run` prints the answer
   and writes the session file.
6. `session:check` reads the file and reports whether the three tools were
   called in order and whether the price agent searched.

## The draft file

`draftPathFor(photoPath)` returns the path with the same directory and base
name and the extension `.md`: `examples/photos/game-boy.jpg` becomes
`examples/photos/game-boy.md`.

```markdown
---
title: Nintendo Game Boy Classic DMG-01, grau
price: 85
currency: EUR
category: Handheld Consoles
condition: used
image: game-boy.jpg
status: draft
---

Verkaufe meinen originalen Game Boy …
```

| Field | Source |
|---|---|
| `title`, `price`, `currency`, `category`, `condition` | Tool arguments, chosen by the model |
| `image` | File name of `photo_path`, set by the tool |
| `status` | Always `draft` when written. A person changes it to `freigegeben` |
| Body | The `description` tool argument |

## `chapter-02-starter`

Built on `chapter-01-solution`.

| File | State |
|---|---|
| `package.json` | Adds the dependency `yaml` and the scripts below |
| `.gitignore`, `.prettierignore` | Add `examples/photos/*.md`, `!examples/photos/README.md`, and `adk/*.session.json` |
| `src/session-state.ts` | Provided. Adds `SEARCH_QUERIES_KEY = 'price_search_queries'` |
| `src/draft/draft-file.ts` | Provided. `listingDraftSchema`, `draftPathFor`, `renderDraft`, `writeDraft`, `DraftExistsError` |
| `src/agents/price-evaluator.ts` | Provided change: an after-model callback `recordSearchQueries` on the agent |
| `src/tools/create-listing-draft.ts` | `TODO(ch02-1)`, `TODO(ch02-2)`. The output schema and the `FunctionTool` are provided |
| `src/agents/listing-agent.ts` | `TODO(ch02-3)`, `TODO(ch02-4)`. The name and the model are set |
| `src/session/tool-calls.ts` | `TODO(ch02-5)`. The type `ToolCall` is provided |
| `adk/listing_agent.ts` | Provided. Sets ADK's log level to warnings and exports the agent as `rootAgent` |
| `examples/replays/listing-agent.json` | Provided. The state with `photo_path` and one query |
| `examples/expected/listing-agent.json` | Provided. The expected tool calls |
| `scripts/support/scripted-llm.ts` | Provided change: an answer can be a text, a tool call, or a text with search queries |
| `scripts/support/run-agent-once.ts` | Provided change: also returns the session |
| `scripts/test-offline-chapter-02.ts` | Provided |
| `scripts/check-session.ts` | Provided |
| `.tutorial/chapter`, `CURRENT_CHAPTER.md` | `02`, and the chapter text |

npm scripts:

| Script | Command | Key needed |
|---|---|---|
| `test:offline` | `tsx scripts/test-offline.ts && tsx scripts/test-offline-chapter-02.ts` | No |
| `agent:listing` | `adk run adk/listing_agent.ts --replay examples/replays/listing-agent.json --save_session --session_id listing-agent` | Yes |
| `session:check` | `tsx scripts/check-session.ts adk/listing-agent.session.json` | No |

The starter typechecks and passes `npm run check`. On the untouched starter:

- `npm run test:offline` passes the chapter 1 part and stops in the chapter 2
  part with `createListingDraft is not implemented yet (TODO ch02-2).`
- `npm run session:check` stops with `No session file:
  adk/listing-agent.session.json. Run "npm run agent:listing" first.` With a
  session file it stops with `toolCallsOf is not implemented yet (TODO
  ch02-5).`

### `src/draft/draft-file.ts` (provided)

- `listingDraftSchema`: `title`, `price` (`z.number().min(0.01)`),
  `currency`, `category`, `condition`, `image`, `status` (`draft` or
  `freigegeben`), `description`. `condition` reuses
  `visionInspectorOutputSchema.shape.condition`.
- `draftPathFor(photoPath)`.
- `renderDraft(draft)`: the frontmatter, written with `yaml`, then the text.
- `writeDraft(photoPath, draft)`: validates, writes with the exclusive flag
  `wx`, returns the draft path. Throws `DraftExistsError` when the file
  exists.

### `recordSearchQueries` on the price agent (provided)

An after-model callback. When the model's response carries
`groundingMetadata.webSearchQueries`, it stores the list in the session state
under `SEARCH_QUERIES_KEY`. It changes nothing else, and chapter 1's tests
still pass.

### `src/tools/create-listing-draft.ts`

- `createListingDraftInputSchema`: `z.object({})` in the starter.
- `createListingDraftOutputSchema` (provided): `{ status: 'success',
  draftPath }` or `{ status: 'error', message }`.
- `createListingDraft(input, toolContext?)`: throws "not implemented" in the
  starter.
- `createListingDraftTool` (provided): the `FunctionTool` named
  `create_listing_draft`.

### `src/session/tool-calls.ts`

- `ToolCall` (provided): `{ tool_name: string; tool_input: Record<string,
  unknown> }`. The field names are the ones ADK's eval items use.
- `toolCallsOf(session)`: takes an object with `events`, as in the saved
  session file. Throws "not implemented" in the starter.

### `scripts/check-session.ts` (provided)

`npm run session:check` reads the session file, prints every tool call with
its arguments and the recorded search queries, and exits 1 when:

- an event carries `errorCode`,
- the tool names from `toolCallsOf` differ from `expected_tool_use` in
  `examples/expected/listing-agent.json`, in number or in order,
- the state has no search query under `price_search_queries`,
- the result of `create_listing_draft` is not a success, or
- the session has no final text answer.

Each failure names what was expected and what was found. The file header says
that `adk eval` replaces this script from ADK 2.3.0.

### `scripts/test-offline-chapter-02.ts` (provided)

All cases use the scripted model and a temp directory. No API key.

6. The draft tool. With `photo_path` set, the draft is written beside the
   photo. The path is built in the test, not through `draftPathFor`. The
   frontmatter has exactly the seven keys with the supplied values, and the
   body equals the description. The input uses a title with a colon, quotes
   and `#`, a description with a `---` line, a currency other than EUR, and a
   photo named `Game Boy.v2.JPG`. A second call returns an error and leaves
   the file unchanged. A missing, empty, or non-string `photo_path`, no tool
   context, and a photo file that does not exist each return an error and
   write nothing. Both schemas reject the prices 0 and -5 and accept 0.01.
7. The wiring. The scripted model calls `vision_inspector`,
   `price_evaluator`, and `create_listing_draft`. The listing agent's request
   declares exactly these three functions. The wrapped vision agent's request
   carries the photo. The draft exists with the scripted fields. The state
   holds the scripted search queries. No request contains `exclusiveMinimum`
   or `exclusiveMaximum`.
8. A failed sub-agent. With a photo path that does not exist, the listing
   agent receives an empty result from `vision_inspector`, and no draft is
   written when the scripted model then answers without a further call.
9. `toolCallsOf`. For the session of case 7 it returns the three calls in
   order, with their arguments. For a session without tool calls it returns
   an empty list.

## Learner tasks

| Task | File | What to do |
|---|---|---|
| `ch02-1` | `src/tools/create-listing-draft.ts` | Input schema: `title`, `price`, `currency`, `category`, `condition`, `description`, each with `.describe()`. `price` and `condition` follow `listingDraftSchema`. No path field |
| `ch02-2` | same | `createListingDraft`: read `photo_path` from the session state. Return an error result when it is missing, the photo file does not exist, or a draft exists. Otherwise call `writeDraft` with `image` and `status: 'draft'` and return the draft path |
| `ch02-3` | `src/agents/listing-agent.ts` | Complete the agent: a description, and as tools `vision_inspector` and `price_evaluator`, each wrapped in `AgentTool`, and `createListingDraftTool` |
| `ch02-4` | same | The instruction: the steps in order, a question in a full sentence for the price agent, what to do when a tool returns nothing or an error, and a final answer that names the draft file |
| `ch02-5` | `src/session/tool-calls.ts` | `toolCallsOf`: return the tool calls of a session, in order, as `ToolCall` values |

`CURRENT_CHAPTER.md` follows the chapter 1 layout. It explains each new term
once: `AgentTool`, function tool, tool context, replay file, session file. It
puts the dev tools first: run with `npm run agent:listing`, look at the run
in `adk web` or in the session file, check it with `npm run session:check`.
It says that ADK provides the runner and the inspection, and that the one
function the learner writes on top, `toolCallsOf`, stands in for `adk eval`.
It says that a draft is never overwritten, so the draft has to be deleted
before a second run on the same photo.

## Chapter 2 criteria

| ID | Type | Requirement |
|---|---|---|
| `ch02-1` | static | The input schema has the six fields, each described, `price` with a lower bound of 0.01 and without `.positive()`, `.gt()`, or `.lt()`, `condition` limited to the three values, and no field for a file path |
| `ch02-2` | static | `createListingDraft` takes the photo path from the session state, returns an error result for a missing path, a missing photo file, and an existing draft, and otherwise writes the draft with `status: draft`. It no longer throws "not implemented" |
| `ch02-3` | static | `listingAgent` is an `LlmAgent` named `listing_agent` with a description, the model from `src/config.ts` as a name, and exactly three tools: `AgentTool` around `visionInspectorAgent`, `AgentTool` around `priceEvaluatorAgent`, and `createListingDraftTool` |
| `ch02-4` | static | The instruction covers inspecting, pricing with a full-sentence question, writing, and saving, says what to do when a tool returns nothing or an error, and asks for a final answer that names the draft file. It uses no curly braces except state placeholders |
| `ch02-5` | static | `toolCallsOf` returns the function calls of the session's events in order, as `tool_name` and `tool_input`. It no longer throws "not implemented" |
| `ch02-tc` | typecheck | `npx tsc --noEmit` exits 0 |
| `ch02-script` | script | `npm run test:offline` exits 0 |
| `ch02-live-1` | live | The session check passes: the three tools in order, at least one search query, a successful draft result |
| `ch02-live-2` | live | The draft beside the photo copy has valid frontmatter, `status: draft`, and a price and a text that fit the photo |

Each criterion gets a hint and a docs link. A hint names the concept and
shows no code.

The criteria file has a `Live test setup:` paragraph: create a temp
directory, copy the photo into it, write a replay file there whose
`photo_path` is the copy, run `adk run` with that replay file and
`--session_id check-chapter`, run `scripts/check-session.ts` on
`adk/check-chapter.session.json`, read the draft in the temp directory, and
delete the session file.

## Changes to the `check-chapter` skill

- The live step gets one sentence: when the criteria file has a `Live test
  setup:` paragraph, follow it before and after the command.
- The hard rule "never edit, create, or delete the learner's files" gets one
  exception: a session file that a `Live test setup:` paragraph names, which
  Git ignores and which the skill deletes again.

## `chapter-02-solution`

Fills in the five TODOs in three files:

- The tool schema describes each field and reuses `listingDraftSchema.shape`
  for `price` and `condition`. The tool turns a missing path, a missing
  photo, and `DraftExistsError` into error results.
- The agent wraps both chapter 1 agents in `AgentTool`. Its instruction lists
  the steps, asks the price agent in a full sentence, asks for a German
  listing, and tells the agent to stop and report when a tool returns nothing
  or an error.
- `toolCallsOf` reads the function calls from the events.

`git diff chapter-02-starter chapter-02-solution` touches only
`src/tools/create-listing-draft.ts`, `src/agents/listing-agent.ts`, and
`src/session/tool-calls.ts`.

## Fix on `chapter-01-starter`

`adk/vision_inspector.ts` and `adk/price_evaluator.ts` call
`setLogLevel(LogLevel.WARN)` before they export the agent. Without it `adk
run` prints one INFO line for each model request between the question and the
answer. The `--log_level` option of `adk run` does not help: the CLI sets the
level on its own copy of ADK, and the agent file loads another one. Found in
the live run of 2026-10-13.

## Changes on `main`

| File | Change |
|---|---|
| `.claude/skills/check-chapter/chapters/chapter-02.md` | New |
| `.claude/skills/check-chapter/SKILL.md` | The two sentences above |
| `scripts/verify-chain.sh` | `CHAIN` gets `chapter-02-starter` and `chapter-02-solution` |
| `README.md` | Status line and chapter table: chapters 1 and 2 are available. How to start chapter 2 from its starter tag, and its three commands |
| `docs/roadmap.md` | Chapter 2 is marked available and names the five tasks |
| `AGENTS.md` | Commands: `agent:listing` and `session:check`. `agent:listing` uses quota and writes a draft and a session file |
| `CONTRIBUTING.md` | The chain examples end at `chapter-02-solution` |
| `docs/adr/0001-model-access-through-adk.md` | A section "Findings for chapter 2": the empty result of a failed sub-agent, state flowing back through `AgentTool`, and a sub-agent's events not being in the parent's session |
| `docs/how-this-was-built.md` | Link to this spec |
| `docs/superpowers/specs/` | This spec |

## Release

Every chapter branch gets release `v4`: `chapter-01-starter-v4`,
`chapter-01-solution-v4`, `chapter-02-starter-v4`, `chapter-02-solution-v4`.
Then `main` and the four branches are pushed with `--force-with-lease`, and
the four tags are pushed. `spec/chapter-02` and
`backup/chapter-02-interactions-attempt` are not pushed.

## The switch to `adk eval`

When ADK 2.3.0 is on npm, after the upgrade steps of spec A:
`examples/expected/listing-agent.json` becomes an eval set,
`scripts/check-session.ts` and the `session:check` script are removed, and
the chapter text points to `adk eval`. Whether `toolCallsOf` stays as an
exercise is decided then.

## Maintainer consent

Asked before the work starts, once for each:

- every live run, with a limit on the number of model calls,
- the four tags,
- the push.

## Acceptance criteria

1. `scripts/verify-chain.sh` passes for all five branches.
2. On `chapter-02-starter`, `npm run test:offline` passes its chapter 1 part
   and stops with the ch02-2 message. On `chapter-02-solution` it passes
   without an API key.
3. On `chapter-02-solution`, the offline test fails when the price in the
   input schema uses `.positive()`, when a tool is missing from the agent,
   when the tool ignores a supplied field, and when `toolCallsOf` drops a
   call. Shown once each.
4. On `chapter-02-solution`, `npm run agent:listing` prints a final answer
   that names the draft, exits 0, and writes the draft and the session file.
   `npm run session:check` then passes and shows three tool calls and at
   least one search query.
5. A second `npm run agent:listing` on the same photo writes no second draft,
   and the answer says that a draft exists.
6. `npm run agent:vision` on `chapter-01-solution` prints no INFO line.
7. `git diff chapter-02-starter chapter-02-solution` touches only the three
   files named above.
8. The `check-chapter` skill reports `ch02-1` to `ch02-5` and `ch02-script`
   unmet and `ch02-tc` met on the starter, and all of them met on the
   solution.
9. No chain branch contains `docs/superpowers/plans/`, `docs/debugging/`, a
   draft, or a session file.
10. The four `v4` tags exist locally and on the remote, and the "Verify
    chain" workflow passes on `main`.
