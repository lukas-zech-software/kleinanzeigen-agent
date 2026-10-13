# Instructions for coding agents

This repository is a tutorial. The person you are working with is learning the
Agent Development Kit (ADK) for TypeScript by building a Kleinanzeigen listing
agent, one chapter at a time. Chapters are Git branches, not folders;
[README.md](README.md) explains the layout.

## Find out where the learner is

- `.tutorial/chapter` holds the two-digit number of the chapter they are on.
  When the file is missing they are not on a chapter branch: point them to
  "Working through a chapter" in the README.
- `CURRENT_CHAPTER.md` describes that chapter: prerequisites, goal, tasks, and
  how to validate them.
- Open tasks are marked in the code as `// TODO(chNN-k)`. A task is done when
  its requirement holds and its TODO comment is deleted.

## Help them learn

- The TODO blocks are the learner's work. Explain the concept, name the file
  and the TODO, link the docs, and review what they wrote. Write the
  implementation of a TODO only when the learner explicitly asks you to.
- Assume the learner is new to ADK. Explain a term the first time you use it
  and keep answers short.
- Never read a `chapter-NN-solution` branch or tag, whatever the Git command.
  When the learner wants the reference solution, give them the command to run:
  `git diff chapter-NN-starter-vK chapter-NN-solution-vK`.
- Never print the value of an API key. `.env` stays out of Git.
- Leave the tutorial's own files as they are: `README.md`, `AGENTS.md`,
  `CURRENT_CHAPTER.md`, `.tutorial/`, `.claude/skills/`, and
  `scripts/verify-chain.sh`.

## Commands

```sh
npm ci                                               # install dependencies
npm run check                                        # banned-API guard, ADK version check, typecheck, format check
npm run typecheck                                    # tsc --noEmit
npm run test:offline                                 # offline test of the chapter's agents, no API key
npm run test:agents -- examples/photos/game-boy.jpg  # live test of the chapter 1 agents
npm run agent:vision                                 # live run of one agent with `adk run` and a replay file
npm run agent:listing                                # live run of the chapter 2 agent, saves a session file
npm run session:check                                # checks the saved session: tool calls and search
npm run agent:web                                    # ADK web UI for the agents in adk/
npm run format                                       # format every file with Prettier
```

`test:agents`, `agent:vision`, `agent:price`, and `agent:listing` call the
Gemini API and use the learner's quota. Ask before you run one of them.
`agent:listing` also writes a draft beside the photo and a session file in
`adk/`. Git ignores both, and an existing draft makes the next run refuse.
`test:offline`, `session:check`, and `check` need no key and no quota.
`examples/photos/` has photos to test with when the learner has none.

## Checking a chapter: the `check-chapter` skill

Use the skill when the learner asks whether their chapter is done, what is
still missing, or for a hint.

- Claude Code loads it from `.claude/skills/check-chapter/` and runs it on a
  question such as "is my chapter done?".
- Any other agent: read `.claude/skills/check-chapter/SKILL.md` and follow its
  procedure and its hard rules. The criteria for chapter NN are in
  `chapters/chapter-NN.md` next to it.

The skill reports which goals are open and where to look. It does not show
solution code, and neither should you while it runs.

## Code style

Prettier decides the formatting (`.prettierrc.json`). Run `npm run format`
after you edit files, and do not reformat by hand. The project is ESM
TypeScript in strict mode: relative imports end in `.js`.

## ADK rules

These rules apply to every change of ADK code in this repository. The reasons
are in [ADR 0001](docs/adr/0001-model-access-through-adk.md). When you change
the tutorial's own ADK code, follow the `adk-typescript` skill: Claude Code
loads it from `.claude/skills/adk-typescript/`, any other agent reads
`.claude/skills/adk-typescript/SKILL.md`.

1. **Read before you write.** Before you implement anything with ADK, read
   the documentation. Treat what you remember about ADK as obsolete until you
   have. The sources, in this order:
   - the guides in `docs/reference/adk-js-guides/` (TypeScript only),
   - the `adk-docs` MCP server from `.mcp.json`, or
     `https://adk.dev/llms.txt` when you have no MCP,
   - the type definitions in `node_modules/@google/adk/dist/types`.
2. **Check the versions first.** Run `npm run check:adk-version`. The
   installed `@google/adk`, the version in `package.json`, and the version the
   guides were checked against must match. A symbol counts only when the
   installed type definitions export it: the guides describe a newer state
   than the release, see `docs/reference/adk-js-guides/SOURCE.md`. On adk.dev,
   use what is shown for TypeScript.
3. **Probe what nobody has run.** A mechanism that has not been run in this
   repository is run once, as cheaply as possible, before a spec, a plan, or
   a chapter depends on it. An offline run with the scripted model in
   `scripts/support/scripted-llm.ts` costs no quota.
4. **Validate with TypeScript.** After every change, use the TypeScript
   language service of the editor where it is available, and otherwise
   `npm run typecheck`.
5. **No Interactions API.** It is banned until the maintainer lifts the ban
   by hand. This includes ADK's `useInteractionsApi` option.
6. **ADK is the only layer that calls the model.** Create no `GoogleGenAI`
   client. Give the model as a name. Take types from `@google/adk`. An import
   from `@google/genai` is allowed only when a value cannot be typed
   otherwise, and the line above it is a comment that starts with
   `// genai-import:` and gives the reason.
7. **Schemas that reach the model** use no `.positive()`, `.gt()`, or
   `.lt()`. ADK turns them into a field the Gemini API rejects. Use `.min()`
   and `.max()`.
8. **Skills for other stacks do not apply here.** `gemini-api-dev` is written
   for the `@google/genai` SDK, and the `google-agents-cli-*` skills for ADK
   in Python and Go. Do not follow them in this repository.

`npm run check:apis` enforces rules 5 and 6, and `npm run test:offline`
checks rule 7 for the schemas of the chapter.

Open work: ADK 2.3.0 will bring `adk eval`. When `npm view @google/adk
version` reports it, follow "Upgrading ADK" in
[CONTRIBUTING.md](CONTRIBUTING.md).
