# Chapter 3: Publisher Agent and Human Handoff

## What you need

- Chapters 1 and 2. This starter contains their reference solutions, so you
  can start here with or without your own.
- Node.js 26 or newer, npm, and your `GEMINI_API_KEY` in `.env`.
- The dependencies from `npm ci`. Nothing new in this chapter.

## Goal

You build the agent that takes a listing draft a person approved and prepares
it for posting. It does not post. Posting cannot be undone, so the agent
stops in front of it and hands a checked package to a person.

The chapter is about that boundary: what an agent may do alone, what a tool
decides, and what stays with a human.

- A person approves a draft by changing `status: draft` to
  `status: freigegeben` in the file. That is the only signal.
- The agent does nothing with a draft that is not approved. Code enforces
  this, not the instruction.
- A tool checks the listing rules and writes the package: a JSON file with
  the fields, the image, and a checklist for the person.
- The model reads the listing critically and writes the handoff note.

The terms this chapter uses:

- A **before-agent callback** runs before the agent does anything. When it
  returns an answer, the agent stops with that answer and the model is not
  called.
- An **eval case** states what a correct run does: for a given state and
  question, which tools the agent calls, with which arguments.
- An **eval set** is a file with eval cases. ADK's eval runner runs each case
  and compares.

## How you work in this chapter

As in chapter 2, ADK's own tools run the agent:

```sh
npm run agent:publisher   # runs the agent on examples/drafts/approved.md and saves the session
npm run agent:web         # the same agent in a web UI
npm run eval:publisher    # runs your eval set with ADK's eval runner
```

`eval:publisher` uses ADK's eval runner. ADK's command for it is `adk eval`.
In ADK 2.3.0 that command cannot load an agent file, so
`scripts/run-evals.ts` calls the function behind it, `runEvals`, with the
same eval set file. The file you write is the one `adk eval` reads.

Chapter 2 could not use the eval runner: it compares tool arguments exactly,
and the listing agent writes its arguments freely. Here the one tool takes no
arguments, so a run either matches or it does not.

## What is already there

- `examples/drafts/`: three drafts to work with. One is approved, one is not,
  and one is approved with a title that is too long.
- `src/draft/read-draft.ts`: `readDraft`, which reads a file and calls your
  `parseDraft`, and the error class `DraftFormatError`.
- `src/listing/rules.ts`: `MAX_TITLE_LENGTH` and the type `Problem`.
- `src/listing/package-file.ts`: `writePackage`, which writes the package
  beside the draft, and the checklist for the person.
- `src/tools/prepare-listing.ts`: the tool definition. Its function throws.
- `src/agents/publisher-agent.ts`: an agent with a name and a model.
- `examples/evals/publisher.evalset.json`: an eval set with one case.
- `scripts/run-evals.ts` and `scripts/test-offline-chapter-03.ts`.

## Your tasks

Each task is marked in the code as `// TODO(ch03-k)`. Delete the comment when
the task is done.

| Task     | File                              | What to do                                                                                                                        |
| -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ch03-1` | `src/draft/read-draft.ts`         | `parseDraft`: turn the text of a draft file back into a validated draft, with a clear error for every way the file can be broken. |
| `ch03-2` | `src/listing/rules.ts`            | `findProblems`: the status, the title length, and the image, each reported with its field.                                        |
| `ch03-3` | `src/tools/prepare-listing.ts`    | `prepareListing`: read the draft from the path in the session state, check it, and write the package or return the problems.      |
| `ch03-4` | `src/agents/publisher-agent.ts`   | `requireApprovedDraft`: the before-agent callback that stops the agent when the draft is not approved.                            |
| `ch03-5` | `src/agents/publisher-agent.ts`   | Complete the agent: description, instruction with `{listing}`, the tool, and the callback.                                        |
| `ch03-6` | `scripts/run-evals.ts` (the note) | Add two eval cases to `examples/evals/publisher.evalset.json`: the approved draft and the one with the long title.                |

Four things to know before you start:

- **A rule that must always hold is code.** "Never act on a draft that is not
  approved" is such a rule. In a before-agent callback the model has no say.
- **The tool trusts nothing.** It reads the draft file again and checks it,
  whatever the agent was told. It takes no arguments, so the model cannot
  hand it a path or a price.
- **The model does what rules cannot.** Whether a text fits its title is a
  judgement. The agent notes it and tells the person. Whether the listing may
  be posted is decided by the tool.
- **A rejected draft is still handed to the tool.** In the third eval case
  the tool refuses the listing, and the agent has still called it once.

## Check your work

```sh
npm run typecheck
npm run test:offline
npm run eval:publisher
npm run agent:publisher
```

`test:offline` needs no API key. It checks your parser, your rules, your
tool, and your callback, and it runs your eval set against a scripted model.
On the untouched starter it passes the cases of chapters 1 and 2 and stops
with `parseDraft is not implemented yet (TODO ch03-1).`

`eval:publisher` and `agent:publisher` call the Gemini API and use your
quota. The case with the draft that is not approved makes no model call.

Both write a package beside the draft, `examples/drafts/approved.listing.json`.
Git ignores package files. A package is written again on every run: it is
derived from the draft, and the draft is what a person edits.

To hand over your own listing from chapter 2: open the draft the listing
agent wrote, check it, set `status: freigegeben`, and put its path into
`examples/replays/publisher-agent.json`.

The chapter is done when:

- `npm run typecheck` reports no errors,
- `npm run test:offline` passes,
- `npm run eval:publisher` reports three or more cases passed and none
  failed, and
- `npm run agent:publisher` answers with the package file and points to
  check, and does not claim that anything was posted.

In Claude Code, ask "is my chapter done?" for a check against each task, with
a hint for whatever is still open.

## Documentation

- [ADK callbacks](https://adk.dev/callbacks/types-of-callbacks/)
- [ADK function tools](https://adk.dev/tools-custom/function-tools/)
- [ADK session state](https://adk.dev/sessions/state/)
- [ADK evaluation](https://adk.dev/evaluate/)
- [ADK agents](https://adk.dev/agents/llm-agents/)
