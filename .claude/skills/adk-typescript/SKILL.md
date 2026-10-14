---
name: adk-typescript
description: Use when changing ADK code of this tutorial itself - an agent, a tool, a callback, a runner, a test script, or the ADK version - before writing any ADK code. Not for tutoring a learner.
---

# ADK TypeScript in this repository

Your knowledge of ADK is older than the installed version, and most ADK
material is written for Python. Do not write ADK code from memory.

This skill is for maintainers' work on the tutorial. When a learner asks for
help with a chapter, follow `AGENTS.md` and the `check-chapter` skill instead.

## Procedure

1. **Versions.** Run `npm run check:adk-version`. When it fails, fix that
   first.
2. **Read.** Open the guide for the unit you touch in
   `docs/reference/adk-js-guides/` (start at its `README.md`). Then read the
   type definition in `node_modules/@google/adk/dist/types`. For what the
   guides lack, use the `adk-docs` MCP server or `https://adk.dev/llms.txt`,
   and only the TypeScript examples.
3. **Confirm the symbol exists.** The guides describe a newer state than the
   release. `grep -rn "<Symbol>" node_modules/@google/adk/dist/types` must
   find an export before you use it.
4. **Probe.** A mechanism nobody has run in this repository is run once
   before you build on it. Use the scripted model in
   `scripts/support/scripted-llm.ts` for wiring, state, callbacks, and the
   shape of a request: it needs no API key. Use one live call only for what
   depends on Gemini itself, and ask first.
5. **Write and typecheck.** After each change, check the editor's TypeScript
   diagnostics or run `npm run typecheck`.
6. **Check.** Run `npm run check` and `npm run test:offline`.
7. **Run it.** One live run with `adk run` and a replay file, for example
   `npm run agent:vision`, after asking, because it uses quota. `adk run`
   prints a model error and exits with 1. `npm run agent:web` opens the web
   UI to inspect events and state.

## Limits found by running it

Each of these cost a failed run. The evidence is named in
`docs/adr/0001-model-access-through-adk.md`.

- The Interactions API is banned. Never set `useInteractionsApi`.
- No `GoogleGenAI` client. The model is a name, and ADK calls it.
- `z.number().positive()`, `.gt()`, and `.lt()` in a schema that reaches the
  model make the Gemini API answer 400. Use `.min()` and `.max()`.
- `GOOGLE_SEARCH` must be the only tool of its agent, and that agent cannot
  have an `outputSchema`. Combine it with other tools through `AgentTool`.
- `GOOGLE_SEARCH` accepts only a model whose name starts with `gemini-`.
- The model decides whether it searches. Read
  `event.groundingMetadata.webSearchQueries` to know that it did.
- `AgentTool` passes only text to the wrapped agent and copies the parent's
  session state into its run. A photo travels through the state and a
  before-model callback.
- A run can fail without throwing: ADK reports a failed model call, and an
  error thrown in a callback, as an event with `errorCode` and
  `errorMessage`.
- Curly braces in an instruction are placeholders for session state keys.
- A before-agent callback that returns an answer stops the agent before the
  model is called. Use it for a rule the agent must never break.
- `adk eval` cannot load an agent file in ADK 2.3.0. Run an eval set with
  `runEvals`, as `scripts/run-evals.ts` does.
- The eval runner compares tool arguments exactly. Use it where a tool takes
  no free text. A run that ends in an error event has no tool call, so a case
  that expects none passes for a broken agent.
- `adk run --log_level` sets the level of the CLI's own copy of ADK. The
  agent's entry file sets the level for the agent with `setLogLevel`. Both are
  needed for a quiet run.
- `adk deploy cloud_run` cannot deploy these agents in ADK 2.3.0: it bundles
  them, the server in its container bundles them again, and no agent loads.
  It also sets `GOOGLE_GENAI_USE_ENTERPRISE=1`, which sends every model call
  to Vertex AI instead of the Gemini API key. Deploy with the `Dockerfile`
  and `cloud/deploy.sh`, and keep `GOOGLE_GENAI_USE_ENTERPRISE=false`.
- ADK's API server keeps sessions in memory. The call that runs an agent must
  reach the instance that created its session: one instance on Cloud Run.

## Commands

| Command                                          | What it does                                                          | API key |
| ------------------------------------------------ | --------------------------------------------------------------------- | ------- |
| `npm run check`                                  | Guard, version check, typecheck, format check                         | No      |
| `npm run test:offline`                           | The agents against the scripted model                                 | No      |
| `npm run test:agents -- <photo>`                 | Both chapter 1 agents, with proof of the search                       | Yes     |
| `npm run agent:vision`, `npm run agent:price`    | `adk run` with a replay file                                          | Yes     |
| `npm run agent:listing`, `npm run session:check` | The chapter 2 agent with `adk run`, then a check of the saved session | Yes, No |
| `npm run agent:publisher`                        | The chapter 3 agent with `adk run`                                    | Yes     |
| `npm run eval:publisher`                         | The chapter 3 eval set with ADK's eval runner                         | Yes     |
| `npm run agent:web`                              | ADK web UI for the agents in `adk/`                                   | To chat |
| `cloud/setup.sh`, `cloud/deploy.sh`              | Chapter 4: creates billable resources in Google Cloud. Ask first      | Yes     |
| `cloud/upload.sh <file>`, `cloud/teardown.sh`    | Runs the agents in the cloud; deletes everything again. Ask first     | Yes, No |
| `scripts/update-adk-guides.sh [ref]`             | Replaces the vendored guides                                          | No      |
