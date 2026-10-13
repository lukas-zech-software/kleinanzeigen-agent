# Chapter 1: Foundation, Setup & Specialist Agents

## What you need

- Node.js 26 or newer and npm.
- A Google AI Studio API key, stored in `.env` as `GEMINI_API_KEY`.
- The dependencies from `npm ci`: `@google/adk`, `@google/adk-devtools`,
  `zod`, `dotenv`, and `tsx`.
- A photo of an item you could sell for the live test. Take your own or use
  one from [examples/photos](examples/photos/README.md).

## Goal

You build the first two agents of the listing system:

- `vision_inspector` looks at a photo and describes the item.
- `price_evaluator` researches a realistic second-hand price range for it.

Each agent does one job, and that is why there are two. In chapter 2 a third
agent uses both of them.

The terms this chapter uses:

- An **agent** is a model with an instruction and, optionally, tools. ADK's
  `LlmAgent` sends the request to the model and gives you the answer as
  events.
- The **instruction** tells the agent what to do. The **description** tells
  other agents what this agent is good for.
- An **output schema** makes the agent answer with a JSON object of a fixed
  shape. You write it with Zod.
- The **session state** is a small key-value store that belongs to one run.
- A **callback** is a function ADK calls at a fixed point. A before-model
  callback runs just before a request goes to the model, and it can change
  the request.
- A **built-in tool** such as Google Search runs on Google's side. The model
  decides whether it uses it.

Two design decisions are made for you:

- **The model never supplies a file path.** The photo path is stored in the
  session state under `photo_path`. Your callback reads it there and adds the
  photo to the request.
- **All model calls go through ADK.** You create no Gemini client. An agent
  gets the model as a name.

## What is already there

- `src/config.ts` loads `.env` and exports `GEMINI_MODEL` (default
  `gemini-3.8-flash`, override it with `GEMINI_MODEL` in `.env`).
- `src/session-state.ts` exports the state key `PHOTO_PATH_KEY`.
- `src/photo.ts` exports `photoPartFor`, which reads a photo file and returns
  it as an image part for a request.
- `src/agents/vision-inspector.ts` and `src/agents/price-evaluator.ts` hold
  the two agents with empty schemas and functions that throw.
- `adk/` has one small file for each agent. The ADK command-line tools load
  an agent from there.
- `scripts/test-offline.ts` and `scripts/test-agents.ts` check your work.

## Your tasks

Each task is marked in the code as `// TODO(ch01-k)`. Delete the comment when
the task is done.

| Task     | File                             | What to do                                                                                                                    |
| -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `ch01-1` | `src/agents/vision-inspector.ts` | Output schema: `title`, `detectedCategory`, `condition` (new, used, or defective), and `keyAttributes` (strings).             |
| `ch01-2` | `src/agents/vision-inspector.ts` | The before-model callback: read `photo_path` from the session state and add the photo to the request.                         |
| `ch01-3` | `src/agents/vision-inspector.ts` | Complete the agent: description, instruction, and the output schema.                                                          |
| `ch01-4` | `src/agents/price-evaluator.ts`  | Output schema: the numbers `priceMin`, `priceMax`, and `recommendedPrice`, and a `currency`.                                  |
| `ch01-5` | `src/agents/price-evaluator.ts`  | Complete the agent: description, `GOOGLE_SEARCH` as its only tool, and an instruction that makes it search and end with JSON. |
| `ch01-6` | `src/agents/price-evaluator.ts`  | `parsePriceAnswer`: find the JSON object in the agent's answer and return it validated with the schema.                       |

Three things to know before you start:

- **Search and an output schema do not mix.** The Gemini API rejects an
  output schema on an agent that uses Google Search. The price agent
  therefore answers with JSON as text, and `parsePriceAnswer` checks it.
  Model output is untrusted input.
- **A plausible price proves nothing.** The model can answer from memory
  without searching. The live test reads the search queries from the answer's
  metadata and fails when there are none.
- **Curly braces in an instruction are placeholders.** ADK replaces a session
  state key in curly braces with its value. Use curly braces for nothing
  else in an instruction, and describe the JSON you want in words.

## Check your work

```sh
npm run typecheck
npm run test:offline
npm run test:agents -- examples/photos/game-boy.jpg
```

`test:offline` needs no API key. It replaces Gemini with a scripted model and
checks what your agents would send: the photo, the output schema, the search
tool. On the untouched starter it stops with
`The photo callback is not implemented yet (TODO ch01-2).`

`test:agents` calls the Gemini API and uses your quota. It prints what both
agents answer and the search queries the price agent ran.

To run one agent by hand:

```sh
npm run agent:vision   # the vision agent on examples/photos/game-boy.jpg
npm run agent:price    # the price agent on a fixed question
npm run agent:web      # a web UI at http://localhost:8000 to chat and inspect events
```

`agent:vision` and `agent:price` use `adk run` with a replay file from
`examples/replays/`. The file holds the session state and the question.

The chapter is done when:

- `npm run typecheck` reports no errors,
- `npm run test:offline` passes,
- `test:agents` prints a `VisionInspectorAgent result:` with plausible
  attributes for your photo, and
- it prints a `PriceEvaluatorAgent result:` with a numeric price range and at
  least one search query.

In Claude Code, ask "is my chapter done?" for a check against each task, with
a hint for whatever is still open.

## Documentation

- [ADK agents](https://adk.dev/agents/llm-agents/)
- [ADK callbacks](https://adk.dev/callbacks/types-of-callbacks/)
- [ADK session state](https://adk.dev/sessions/state/)
- [Google Search tool for ADK](https://adk.dev/integrations/google-search/)
- [Google Search grounding](https://adk.dev/grounding/google_search_grounding/)
- [Zod](https://zod.dev/)
