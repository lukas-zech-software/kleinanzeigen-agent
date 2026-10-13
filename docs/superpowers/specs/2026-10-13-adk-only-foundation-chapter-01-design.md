# ADK-only foundation: project rules, agent tooling, and chapter 1

Date: 2026-10-13
Status: approved 2026-10-13

## Purpose

The project calls Gemini through two layers today: ADK, and the `@google/genai`
SDK directly. A guideline taken from a skill for that SDK led the chapter 2
work onto the Interactions API, and the result did not run. The reasons and
the decisions that followed are in
[ADR 0001](../../adr/0001-model-access-through-adk.md).

This spec makes ADK the only layer. It has two parts:

1. rules and tooling on `main`, so that a coding agent in this repository
   reads the right documentation and cannot repeat the mistake unnoticed, and
2. chapter 1 rebuilt as two specialist agents without `@google/genai`.

Chapter 2 is rewritten in a second spec ("spec B") on top of this one.

## Scope

In scope:

- `AGENTS.md` rules, a guard script, a version check, the vendored ADK
  TypeScript guides, an MCP configuration for the ADK docs, and a project
  skill for ADK work.
- Removal of the `gemini-api-dev` skill.
- ADR 0001 on `main`.
- `chapter-01-starter` and `chapter-01-solution`, rebuilt.
- The chapter 1 criteria, the `script` criterion type of the `check-chapter`
  skill, and the chain check.
- The texts on `main` that describe chapter 1.

Out of scope:

- Chapter 2. Spec B covers it. Until then the chain has three branches.
- Tags and pushes. One release, `v4`, is cut at the end of spec B.
- `gs://` photo paths. They return when chapter 4 needs them.
- Evaluations with `adk eval` and `runEvals`. They were merged into adk-js on
  2026-10-12 and are not in 2.2.1. See "Evals and the upgrade to ADK 2.3.0".
- ESLint. The guard is a script.
- The debugging samples under `docs/debugging/`. They stay on the maintainer
  branch, because their probe scripts are close to solution code.

## Decisions

| Topic | Decision |
|---|---|
| Model API | `generateContent` through ADK, with the model given as a name. No Interactions API (ADR 0001, decision 1) |
| `@google/genai` | No client and no API call. An import is an exception that needs a comment (decision 2) |
| Chapter 1 shape | Two agents: a vision agent with `outputSchema`, a price agent with `GOOGLE_SEARCH` (decision 3) |
| Photo input | A before-model callback reads `photo_path` from the session state (decision 4) |
| Schemas | No `.positive()`, `.gt()`, `.lt()` in a schema that reaches the model (decision 5) |
| Price answer | JSON as text, validated in code. No `outputSchema` beside search (decision 6) |
| Search | Proven from `groundingMetadata.webSearchQueries`, not assumed (decision 7) |
| ADK version | Pinned exactly: `@google/adk` and `@google/adk-devtools` at `2.2.1` |
| Guides | The adk-js guides from `main`, vendored and pinned to a commit, with a version check |
| Running an agent | `adk run --replay` and `adk web` from `@google/adk-devtools` |
| Offline test | A scripted model object that the test gives to the agents. No API key |
| Guard | A script, not Prettier. Prettier formats and cannot report forbidden words |
| Evals | Bridged in spec B with a check of the expected tool calls. The switch to `adk eval` happens when ADK 2.3.0 is on npm |
| Release | None in this spec. The texts already name `v4` |

Every mechanism in this spec was run before the spec was written. The
evidence is in `docs/debugging/2026-10-13-adk-mechanism-probes/` on the
maintainer branch. Four later probes ran offline with a scripted model:
`adk run --replay` with a TypeScript agent file, its exit code 1 on a model
error, `adk web` listing an agent from a folder, and an entry file that
imports project sources with `.js` suffixes.

## Starting state

Nothing of the abandoned chapter 2 work was pushed. Before the work starts:

- A branch `backup/chapter-02-interactions-attempt` is created at the current
  `chapter-02-solution`, so that the draft file code and the offline test can
  be reused in spec B.
- The local branches `main`, `chapter-01-starter`, and `chapter-01-solution`
  are reset to `origin/main`, `origin/chapter-01-starter`, and
  `origin/chapter-01-solution`.
- The local branches `chapter-02-starter` and `chapter-02-solution` are
  deleted.

The maintainer confirms this step, because it discards local commits.

## Part 1: rules and tooling on `main`

### `AGENTS.md`

The section "Gemini API Guidelines" is replaced by "ADK rules":

1. **Read before you write.** Before you implement anything with ADK, read
   the documentation. Treat what you remember about ADK as obsolete until you
   have. The sources, in this order: the vendored guides in
   `docs/reference/adk-js-guides/`, the `adk-docs` MCP server or
   `https://adk.dev/llms.txt`, and the type definitions in
   `node_modules/@google/adk/dist/types`.
2. **Check the versions first.** The installed `@google/adk`, the version in
   `package.json`, and the version recorded with the guides must match. Run
   `npm run check:adk-version`. A symbol counts only when the installed type
   definitions export it. On adk.dev, use what is shown for TypeScript.
3. **Probe what nobody has run.** A mechanism that has not been run in this
   repository is run once, as cheaply as possible, before a spec, a plan, or a
   chapter depends on it.
4. **Validate with TypeScript.** After every change, use the editor's
   TypeScript language service where it is available, and otherwise
   `npm run typecheck`.
5. **No Interactions API.** It is banned until the maintainer lifts the ban
   by hand. This includes ADK's `useInteractionsApi`.
6. **ADK is the only layer that calls the model.** No `GoogleGenAI` client.
   The model is given as a name. Types come from `@google/adk`. An import from
   `@google/genai` is allowed only when a value cannot be typed otherwise, and
   the line above it is a comment that starts with `// genai-import:` and
   gives the reason.
7. **Schemas that reach the model** use no `.positive()`, `.gt()`, or
   `.lt()`. Use `.min()` and `.max()`.
8. **Skills for other stacks do not apply here:** `gemini-api-dev` (the genai
   SDK) and `google-agents-cli-*` (ADK for Python and Go).

The section links ADR 0001 and names the `adk-typescript` skill. The Commands
block lists the new scripts. The tutoring rules above it stay as they are.

### The guard: `scripts/check-banned-apis.sh`

Callable as `npm run check:apis`. It searches the tracked `.ts` files under
`src/`, `scripts/`, and `adk/` and fails, naming file and line, when it finds:

- `useInteractionsApi`,
- `interactions.create` or `.interactions.`,
- `GoogleGenAI`,
- an import from `@google/genai` whose previous line does not start with
  `// genai-import:`.

It also fails when `package.json` lists `@google/genai` and no source file
imports it. It passes when none of the three folders exists, as on `main`.

### The version check: `scripts/check-adk-version.sh`

Callable as `npm run check:adk-version`. It fails when:

- the installed `@google/adk` version differs from the one in `package.json`,
- `@google/adk-devtools` differs from `@google/adk`, or
- the version in `docs/reference/adk-js-guides/VERSION` differs from the
  installed one.

### `npm run check`

Runs `check:apis`, `check:adk-version`, `format:check`, and `typecheck` when
the branch has one. `build` runs `check:apis` before `tsc`.

### Documentation

- `docs/reference/adk-js-guides/`: the developer guides of
  [google/adk-js](https://github.com/google/adk-js), copied unchanged from
  `docs/guides/` on `main`, with `docs/adk-ts-improvements.md`. `SOURCE.md`
  names the repository, the commit, the date, and the license, and it lists
  the symbols the guides name that 2.2.1 does not export. `VERSION` holds the
  ADK version the copy was checked against and the commit, one `key=value`
  per line.
- `scripts/update-adk-guides.sh [ref]` replaces the copy from a ref (default
  `main`) with a sparse Git checkout, and rewrites `SOURCE.md` and `VERSION`.
  It needs no GitHub CLI.
- `LICENSES/Apache-2.0.txt` stays. The README's license paragraph names the
  guides in place of the removed skill.
- `.mcp.json` with one server, `adk-docs`: `uvx --from mcpdoc --with "mcp<2"
  mcpdoc --urls AgentDevelopmentKit:https://adk.dev/llms.txt --transport
  stdio`, as adk.dev gives it. The README lists `uv` as optional.

### The `adk-typescript` skill

`.claude/skills/adk-typescript/SKILL.md`, for agents that change the
tutorial's ADK code. It is not for tutoring a learner. Its procedure:

1. Run `npm run check:adk-version`.
2. Read the guide for the unit you touch, then the type definitions.
3. Probe a mechanism nobody has run here, and keep the output.
4. Write the change. Typecheck after each step.
5. Run `npm run test:offline`, then one live run with `adk run --replay`,
   after asking, because it uses quota.

It lists the limits from ADR 0001 and the commands. Agents other than Claude
Code are pointed to the file from `AGENTS.md`, as for `check-chapter`.

### Removed and moved

- Removed: `.agents/skills/gemini-api-dev/`, `.claude/skills/gemini-api-dev`,
  `skills-lock.json`, and the README sentence about the skill.
- Moved to `main`: `docs/adr/0001-model-access-through-adk.md`, with its two
  links to `docs/debugging/` replaced by a sentence that says where the
  evidence is kept. `docs/how-this-was-built.md` links the ADR.

### `check-chapter` skill and chain check

- `SKILL.md` gets the `script` criterion step: run the script command named in
  the criteria file without asking, because it needs no key. Met when it exits
  0.
- `scripts/verify-chain.sh` keeps its chain of three branches and gets two
  invariants. Invariant 7: on a solution branch, `npm run test:offline
  --if-present` exits 0 with the API key variables unset. Invariant 8: on
  every branch, `npm run check:apis` and `npm run check:adk-version` exit 0.

### Evals and the upgrade to ADK 2.3.0

`runEvals`, `convertSessionToEvalFormat`, and the `adk eval` command exist on
the `main` branch of adk-js since 2026-10-12 (pull request 1049). ADK 2.2.1
was published on 2026-10-06 and has none of them. The release pull request
for 2.3.0 (number 975) is open.

Until 2.3.0 is on npm:

- Chapter 1 needs no eval. Its agents make no function calls, and its checks
  are the offline test and the search proof in the live test.
- Spec B checks the tool calls of the listing agent itself. It stores the
  expected calls as data in the shape ADK's eval items use
  (`expected_tool_use` with `tool_name` and `tool_input`), so that they become
  an eval set without rewriting.

When `npm view @google/adk version` reports 2.3.0 or newer, the upgrade is:

1. Set both ADK packages to the new version in `package.json`.
2. Run `scripts/update-adk-guides.sh` and update the list of missing symbols
   in `SOURCE.md`. `npm run check:adk-version` fails until this is done.
3. Run the offline test and the live tests on every chapter branch.
4. Replace the tool call check of spec B by an eval set and `adk eval`.

`AGENTS.md` names this upgrade as open work.

## Part 2: chapter 1, "Foundation, setup and specialist agents"

### What the learner builds

```
photo ──▶ vision_inspector   LlmAgent, outputSchema, before-model callback
                             reads photo_path from the session state
query ──▶ price_evaluator    LlmAgent, GOOGLE_SEARCH, answers with JSON as text
                             parsePriceAnswer validates the text
```

The chapter teaches: an agent and its instruction, structured output, a
callback, session state, a built-in tool, and why model output is validated
like any other untrusted input.

### `chapter-01-starter`

| File | State |
|---|---|
| `package.json` | No `@google/genai`. ADK and its devtools pinned to `2.2.1`. Scripts, see below |
| `src/config.ts` | Provided. Loads `.env`, exports `GEMINI_MODEL` (default `gemini-3.8-flash`). `getGenAI()` is gone |
| `src/session-state.ts` | Provided. `PHOTO_PATH_KEY = 'photo_path'` |
| `src/photo.ts` | Provided. `photoPartFor(photoPath)` reads a local JPEG, PNG, or WebP file and returns the image part. It throws a readable error for a missing file or another extension |
| `src/agents/vision-inspector.ts` | `TODO(ch01-1)`, `TODO(ch01-2)`, `TODO(ch01-3)` |
| `src/agents/price-evaluator.ts` | `TODO(ch01-4)`, `TODO(ch01-5)`, `TODO(ch01-6)` |
| `adk/vision_inspector.ts`, `adk/price_evaluator.ts` | Provided. Each exports its agent as `rootAgent`, the layout the devtools load |
| `examples/replays/vision-inspector.json`, `examples/replays/price-evaluator.json` | Provided. The session state and one query for `adk run --replay` |
| `scripts/support/scripted-llm.ts` | Provided. A scripted model object. `useScriptedModel` replaces the model of an agent with it. It records each request and answers from a list the test gives it. It is not registered by name: ADK's `GOOGLE_SEARCH` accepts only a model whose name starts with `gemini-`, and the registry resolves every such name to the real Gemini class |
| `scripts/support/run-agent-once.ts` | Provided. Runs an agent for one message and a state, returns the events and the final text, and throws on an event that carries `errorCode` |
| `scripts/test-offline.ts` | Provided |
| `scripts/test-agents.ts` | Provided. Replaces `scripts/test-tools.ts` |
| `.tutorial/chapter`, `CURRENT_CHAPTER.md` | `01`, and the chapter text |

The starter typechecks and passes `npm run check:apis`. On the untouched
starter, `npm run test:offline` stops with `The agent run failed:
UNKNOWN_ERROR The photo callback is not implemented yet (TODO ch01-2).` ADK
reports an error thrown in a callback as an error event, and the run helper
turns that event into this error. `npm run test:agents` stops with the same
message when an API key is set, and sends no request. Without a key it stops
earlier, with ADK's message that names the key variable, because ADK creates
the model before it calls the callback.

npm scripts:

| Script | Command | Key needed |
|---|---|---|
| `typecheck` | `tsc --noEmit` | No |
| `check`, `check:apis`, `check:adk-version` | See part 1 | No |
| `test:offline` | `tsx scripts/test-offline.ts` | No |
| `test:agents` | `tsx scripts/test-agents.ts <photo>` | Yes |
| `agent:vision` | `adk run adk/vision_inspector.ts --replay examples/replays/vision-inspector.json` | Yes |
| `agent:price` | `adk run adk/price_evaluator.ts --replay examples/replays/price-evaluator.json` | Yes |
| `agent:web` | `adk web adk` | Yes, to chat |

### Learner tasks

| Task | File | What to do |
|---|---|---|
| `ch01-1` | `src/agents/vision-inspector.ts` | Output schema: `title`, `detectedCategory`, `condition` (new, used, defective), `keyAttributes` (strings), each with `.describe()` |
| `ch01-2` | same | The before-model callback `addPhotoToRequest`: read `photo_path` from the session state, get the image part from `photoPartFor`, and add it to the request. Fail with an error that names `photo_path` when the state has none |
| `ch01-3` | same | Complete the agent `visionInspectorAgent`: a description, an instruction, and the output schema. The starter sets the name `vision_inspector`, the model from `src/config.ts`, and the callback, so that the untouched starter stops at `ch01-2` |
| `ch01-4` | `src/agents/price-evaluator.ts` | Output schema: the numbers `priceMin`, `priceMax`, `recommendedPrice`, and a `currency` |
| `ch01-5` | same | Complete the agent `priceEvaluatorAgent`: a description, `GOOGLE_SEARCH` as its only tool, and an instruction that makes it search and end its answer with one JSON object. The starter sets the name `price_evaluator` and the model |
| `ch01-6` | same | `parsePriceAnswer(text)`: find the JSON object in the agent's answer, also inside a code fence or after prose, and return it parsed with the output schema. Throw when there is none or it does not match |

### `scripts/test-offline.ts` (provided)

It replaces the model of both agents with the scripted model. Cases:

1. Vision, with `photo_path` in the state: the request the model receives has
   an image part with the MIME type of the photo and a response schema. With a
   scripted JSON answer, the final text parses with
   `visionInspectorOutputSchema`.
2. Vision, without a usable photo: no `photo_path`, an empty one, one that is
   not a string, a file that does not exist, and a file type that is not a
   photo. Each run fails with a clear error, and the model is not called.
3. Price: the request declares Google Search, no function declaration, and no
   response schema.
4. No recorded request contains `exclusiveMinimum` or `exclusiveMaximum`.
5. `parsePriceAnswer`: accepts plain JSON, JSON in a code fence, and JSON
   after prose. Rejects text without JSON and an object with a missing field.

### `scripts/test-agents.ts` (provided, live)

`npm run test:agents -- <photo>` runs the vision agent with the photo in the
state and prints `VisionInspectorAgent result:`. It asks the price agent in a
full sentence built from that result, prints `PriceEvaluatorAgent result:`
with the parsed object, and prints `Search queries:` from the event's
grounding metadata. It exits 1 when the list is empty: a price from the
model's memory does not pass.

### Chapter 1 criteria

| ID | Type | Requirement |
|---|---|---|
| `ch01-1` | static | The vision output schema has the four fields, `condition` limited to the three values, each field described |
| `ch01-2` | static | The callback takes the photo path from the session state, adds the image to the request, and fails with a clear error without a path. It no longer throws "not implemented" |
| `ch01-3` | static | `visionInspectorAgent` is an `LlmAgent` named `vision_inspector` with a description, the model from `src/config.ts` as a name, an instruction, the output schema, and the callback |
| `ch01-4` | static | The price output schema has three numbers and a currency, each described. This schema is not sent to the model, so the rule about `.positive()` does not apply to it |
| `ch01-5` | static | `priceEvaluatorAgent` is an `LlmAgent` named `price_evaluator` whose only tool is `GOOGLE_SEARCH`. It has no output schema. Its instruction asks for a search and for a JSON object at the end |
| `ch01-6` | static | `parsePriceAnswer` extracts the JSON, validates it with the output schema, and throws on invalid input |
| `ch01-tc` | typecheck | `npx tsc --noEmit` exits 0 |
| `ch01-script` | script | `npm run test:offline` exits 0 |
| `ch01-live-1` | live | The output has a `VisionInspectorAgent result:` with attributes that fit the photo |
| `ch01-live-2` | live | The output has a `PriceEvaluatorAgent result:` with a numeric range and at least one entry under `Search queries:`, and the script exits 0 |

Each criterion gets a hint and a docs link. A hint names the concept and shows
no code. The live test command is `npx tsx scripts/test-agents.ts
<path-to-photo>`. It writes no file.

### `chapter-01-solution`

Fills in the six TODOs in the two agent files and nothing else. The price
agent's instruction is checked live: the run counts only when the event
carries search queries. `git diff chapter-01-starter chapter-01-solution`
touches only `src/agents/vision-inspector.ts` and
`src/agents/price-evaluator.ts`.

### Texts on `main`

| File | Change |
|---|---|
| `.claude/skills/check-chapter/chapters/chapter-01.md` | Rewritten for the criteria above, with a `Script command:` line |
| `README.md` | Chapter 1 teaches agents, structured output, a callback, and search. The quick start uses `test:agents`, with a sample output. Tags read `v4`. The guided tour names the ADR and the guard |
| `CURRENT_CHAPTER.md` | Tag `v4` |
| `docs/roadmap.md` | Chapter 1 rewritten. Chapter 2 stays "Planned" and no longer mentions Google Drive: the listing agent combines the two agents through `AgentTool` and saves a draft as a local file. Spec B replaces that section |
| `AGENTS.md` | The Commands block, besides part 1 |
| `CONTRIBUTING.md` | Tags read `v4`. A paragraph on `npm run check` and on refreshing the guides |
| `docs/how-this-was-built.md` | Links this spec and ADR 0001, and adds "probe before you specify" to what the author took from it |

## Maintainer consent

Asked separately each time:

- the reset of the local branches in "Starting state",
- every live run (`test:agents`, `agent:vision`, `agent:price`), because it
  uses quota.

This spec has no push and no tag.

## Acceptance criteria

1. `scripts/verify-chain.sh` passes for `main`, `chapter-01-starter`, and
   `chapter-01-solution`, including invariants 7 and 8.
2. On the three branches, `package.json` does not list `@google/genai` and
   no `.ts` file imports it.
3. `npm run check:apis` fails with file and line for each of the four
   patterns, shown once with a temporary file, and passes without it.
4. `npm run check:adk-version` fails when `VERSION` names another version,
   shown once, and passes otherwise.
5. On `chapter-01-starter`, `npm run test:offline` stops with the ch01-2
   message. On `chapter-01-solution` it passes without an API key, and it
   fails when a schema with an exclusive bound, an output schema beside
   search, a missing callback, or a missing search tool is introduced.
6. On `chapter-01-solution`, `npm run test:agents -- examples/photos/game-boy.jpg`
   prints both results and at least one search query, and exits 0.
7. On `chapter-01-solution`, `npm run agent:vision` prints an answer that
   describes the photo and exits 0. With a wrong model name in `GEMINI_MODEL`
   it prints an error and exits 1.
8. On `chapter-01-starter`, the `check-chapter` skill reports `ch01-1` to
   `ch01-6` and `ch01-script` unmet and `ch01-tc` met. On the solution it
   reports them met.
9. `AGENTS.md`, the README, and the roadmap on `main` do not mention the
   Interactions API as something to use, `gemini-api-dev`, or Google Drive.
10. The `adk-docs` MCP server starts with the command in `.mcp.json` and
    lists its tools.
