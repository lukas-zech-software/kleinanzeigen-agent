# Chapter 2: Listing Agent and Human Review

## What you need

- Chapter 1. This starter contains its reference solution, so you can start
  here with or without your own. Your chapter 1 code stays on your branch.
- Node.js 26 or newer, npm, and your `GEMINI_API_KEY` in `.env`.
- The dependencies from `npm ci`. New in this chapter: `yaml`.
- A photo of an item you could sell. Take your own or use one from
  [examples/photos](examples/photos/README.md).

## Goal

You build the agent that turns a photo into a listing draft. It asks
`vision_inspector` what the photo shows, asks `price_evaluator` what the item
sells for, writes a listing text, and saves a draft: a Markdown file with
YAML frontmatter, beside the photo.

The agent never publishes anything. The draft has `status: draft`. A person
reads it, edits it, and changes the status to `freigegeben` (German for
"approved"). Chapter 3 picks up from there.

The terms this chapter uses:

- **`AgentTool`** wraps an agent so that another agent can call it like a
  tool, under its name.
- A **function tool** is a function of yours that the agent may call. Its Zod
  schema tells the model which arguments it takes.
- The **tool context** is the second argument of a tool function. The session
  state is on it.
- A **replay file** holds the session state and the question for one run.
  `adk run` reads it, so you can run an agent without typing.
- A **session file** is what `adk run --save_session` writes: every event of
  the run and the final state.

## How you work in this chapter

ADK comes with the tools to run an agent and to see what it did. You do not
write a runner, and you do not write code that prints events.

```sh
npm run agent:listing   # runs the agent with `adk run` and saves the session
npm run agent:web       # the same agent in a web UI, with every event and the state
npm run session:check   # checks the saved session: the tool calls and the search
```

`agent:listing` prints the question and the agent's final answer. It does not
print the tool calls. They are in the session file,
`adk/listing-agent.session.json`, and in the web UI.

`session:check` is the one piece of checking code in this chapter, and you
write its core in `ch02-5`. It is a stand-in: ADK 2.3 brings `adk eval`, which
checks a run against expected tool calls without any code of yours.

## What is already there

- `src/agents/vision-inspector.ts` and `src/agents/price-evaluator.ts`: the
  agents from chapter 1. The price agent has one addition, the callback
  `recordSearchQueries`. It stores the agent's Google searches in the session
  state, because an agent that calls another agent does not see its events.
- `src/draft/draft-file.ts`: the draft schema `listingDraftSchema`,
  `draftPathFor`, and `writeDraft`, which never overwrites an existing draft
  and throws `DraftExistsError` instead.
- `src/tools/create-listing-draft.ts`: the tool definition and its output
  schema. The input schema is empty and the function throws.
- `src/agents/listing-agent.ts`: an agent with a name and a model.
- `src/session/tool-calls.ts`: the type `ToolCall` and a function that throws.
- `adk/listing_agent.ts`, `examples/replays/listing-agent.json`, and
  `examples/expected/listing-agent.json`: what `adk run` loads, the state and
  the question for a run, and the tool calls a good run makes.
- `scripts/test-offline-chapter-02.ts` and `scripts/check-session.ts`: the
  offline test and the session check.

## Your tasks

Each task is marked in the code as `// TODO(ch02-k)`. Delete the comment when
the task is done.

| Task     | File                                | What to do                                                                                                                                                                           |
| -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ch02-1` | `src/tools/create-listing-draft.ts` | Input schema: `title`, `price`, `currency`, `category`, `condition`, and `description`. `price` and `condition` follow `listingDraftSchema`. No field for a file path.               |
| `ch02-2` | `src/tools/create-listing-draft.ts` | `createListingDraft`: read `photo_path` from the session state. Return an error result when it is missing, the photo does not exist, or a draft exists. Otherwise call `writeDraft`. |
| `ch02-3` | `src/agents/listing-agent.ts`       | Complete the agent: a description, and as tools both chapter 1 agents, each in an `AgentTool`, and `createListingDraftTool`.                                                         |
| `ch02-4` | `src/agents/listing-agent.ts`       | The instruction: the steps, a full-sentence question for the price agent, what to do when a tool returns nothing or an error, and a final answer that names the draft file.          |
| `ch02-5` | `src/session/tool-calls.ts`         | `toolCallsOf`: return the tool calls of a session, in order.                                                                                                                         |

Four things to know before you start:

- **The model never supplies a file path.** The photo path is in the session
  state, as in chapter 1. `AgentTool` copies the state into the run of the
  agent it wraps, and your tool reads it from its tool context.
- **An expected failure is a result.** `create_listing_draft` returns
  `{ status: 'error', message }` when a draft already exists. The agent reads
  that and tells you. A thrown error is for a failure nobody planned for.
- **A failing agent behind `AgentTool` returns nothing.** When
  `vision_inspector` cannot read the photo, your agent gets an empty result,
  not an error. Your instruction has to say what to do then, or the model may
  make up a listing.
- **No `.positive()` in a schema the model sees.** ADK turns it into a field
  the Gemini API rejects. `listingDraftSchema` uses `.min(0.01)` for the
  price, and your input schema can reuse that field.

The listing language is your choice. Set it in your instruction.

## Check your work

```sh
npm run typecheck
npm run test:offline
npm run agent:listing
npm run session:check
```

`test:offline` needs no API key. It runs all three agents against a scripted
model and checks the draft your tool writes, the tools your agent declares,
and what `toolCallsOf` returns. On the untouched starter it passes the
chapter 1 cases and stops with
`createListingDraft is not implemented yet (TODO ch02-2).`

`agent:listing` calls the Gemini API and uses your quota. It works on
`examples/photos/game-boy.jpg` and writes the draft beside it, as
`examples/photos/game-boy.md`. Git ignores that file and the session file.

A draft is never overwritten. Delete `examples/photos/game-boy.md` before you
run the agent on the same photo again, or the tool refuses and the agent
tells you so.

To use your own photo, change `photo_path` in
`examples/replays/listing-agent.json`.

The chapter is done when:

- `npm run typecheck` reports no errors,
- `npm run test:offline` passes,
- `npm run session:check` passes after a run: three tool calls in order, at
  least one search query, a saved draft, and
- the draft has valid frontmatter, `status: draft`, and a price and a text
  that fit your photo.

In Claude Code, ask "is my chapter done?" for a check against each task, with
a hint for whatever is still open.

## Documentation

- [ADK agents](https://adk.dev/agents/llm-agents/)
- [ADK function tools and agents as tools](https://adk.dev/tools-custom/function-tools/)
- [ADK session state](https://adk.dev/sessions/state/)
- [ADK events](https://adk.dev/events/)
- [ADK callbacks](https://adk.dev/callbacks/types-of-callbacks/)
- [yaml](https://eemeli.org/yaml/)
