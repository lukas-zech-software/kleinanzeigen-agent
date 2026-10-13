# Chapter 2 criteria: Listing Agent and Human Review

Goal: an ADK agent, `listing_agent`, that uses the two agents of chapter 1
through `AgentTool`, writes a listing text, and saves a draft file beside the
photo for a person to review.

Script command: `npm run test:offline`
Live test command: `npx adk run adk/listing_agent.ts --replay <temp-dir>/replay.json --save_session --session_id check-chapter`
Live test setup: The command writes a draft beside the photo, and an existing
draft makes the tool refuse. So do not run it on a photo in the learner's
tree. Before the command: create a temp directory with `mktemp -d`, copy the
photo into it, and write `<temp-dir>/replay.json` with the content
`{"state": {"photo_path": "<temp-dir>/<photo>"}, "queries": ["Create the listing draft for the photo."]}`.
After the command: run `npx tsx scripts/check-session.ts adk/check-chapter.session.json`
and judge `ch02-live-1` from its output. Read the `.md` file in the temp
directory to judge `ch02-live-2`. Then delete
`adk/check-chapter.session.json`.
Required key: `GEMINI_API_KEY`

## ch02-1 Draft tool input schema

- Type: static
- Target: `src/tools/create-listing-draft.ts`, export
  `createListingDraftInputSchema`
- Requirement: a Zod object with `title`, `price`, `currency`, `category`,
  `condition` (limited to new, used, defective), and `description`, each with
  a `.describe()` text. `price` has a lower bound of 0.01 and uses no
  `.positive()`, `.gt()`, or `.lt()`. It has no field for a file path.
- Hint: The model fills these fields, so it can also get them wrong. The rules
  for a valid price and a valid condition already exist in the draft schema,
  and a schema field can be reused. The path is missing on purpose: the model
  must not decide where a file is written.
- Docs: https://adk.dev/tools-custom/function-tools/

## ch02-2 Draft tool

- Type: static
- Target: `src/tools/create-listing-draft.ts`, export `createListingDraft`
- Requirement: takes the photo path from the session state and not from its
  arguments. Returns an error result when the path is missing, the photo file
  does not exist, or a draft already exists. Otherwise writes the draft with
  `status: draft` and returns its path. It no longer throws "not implemented".
- Hint: A tool gets a second argument, the tool context, and the session state
  is on it. A failure you expect is a result the agent can read and report. An
  exception is for a failure you did not expect.
- Docs: https://adk.dev/sessions/state/

## ch02-3 Listing agent

- Type: static
- Target: `src/agents/listing-agent.ts`, export `listingAgent`
- Requirement: an `LlmAgent` named `listing_agent` with a description, the
  model from `src/config.ts` given as a name, and exactly three tools:
  `visionInspectorAgent` wrapped in `AgentTool`, `priceEvaluatorAgent` wrapped
  in `AgentTool`, and `createListingDraftTool`.
- Hint: An agent can use another agent like a tool. The wrapper makes the
  other agent callable under its name, and its description tells this agent
  when to call it. The price agent has to stay alone with its search tool,
  and that is why it is wrapped and not merged in.
- Docs: https://adk.dev/tools-custom/function-tools/

## ch02-4 Listing agent instruction

- Type: static
- Target: `src/agents/listing-agent.ts`, the `instruction` of `listingAgent`
- Requirement: covers describing the item, getting a price with a question in
  a full sentence, writing the listing, and saving the draft, in this order.
  Says what the agent does when a tool returns nothing or an error. Asks for a
  final answer that names the draft file. Uses no curly braces.
- Hint: An agent behind `AgentTool` that fails returns an empty result, not an
  error, so the instruction has to cover "nothing came back". The price agent
  searches when it is asked a real question and may answer from memory when it
  only gets an item name.
- Docs: https://adk.dev/agents/llm-agents/

## ch02-5 Tool calls of a session

- Type: static
- Target: `src/session/tool-calls.ts`, export `toolCallsOf`
- Requirement: returns the function calls of the session's events, in order,
  each as `tool_name` and `tool_input`. Returns an empty list for a session
  without tool calls. It no longer throws "not implemented".
- Hint: A session is a list of events, and an event holds a function call as
  a part of its content. ADK exports a helper that reads the function calls of
  one event.
- Docs: https://adk.dev/events/

## ch02-tc Typecheck

- Type: typecheck
- Target: whole project
- Requirement: `npx tsc --noEmit` exits 0.
- Hint: Read the first error only; later ones often follow from it.
- Docs: https://adk.dev/agents/llm-agents/

## ch02-script Offline test

- Type: script
- Target: `scripts/test-offline.ts`, `scripts/test-offline-chapter-02.ts`
- Requirement: `npm run test:offline` exits 0.
- Hint: The failing assertion names its case. Cases 1 to 5 are chapter 1.
  Case 6 is the draft tool, case 7 the agent's tools, case 8 a failing
  sub-agent, and case 9 `toolCallsOf`.
- Docs: https://adk.dev/tools-custom/function-tools/

## ch02-live-1 The agent calls the three tools in order and the price agent searches

- Type: live
- Target: the session file `adk/check-chapter.session.json`
- Requirement: `scripts/check-session.ts` exits 0 on the session file. Its
  output lists `vision_inspector`, `price_evaluator`, and
  `create_listing_draft` in this order, at least one search query, and a
  draft result with the status `success`.
- Hint: A missing or reordered tool call points at the instruction: number
  the steps and name the tool for each. An empty list of search queries means
  the price agent was not asked a full question.
- Docs: https://adk.dev/agents/llm-agents/

## ch02-live-2 A plausible draft exists beside the photo

- Type: live
- Target: the `.md` file beside the photo copy
- Requirement: the file has frontmatter that parses, `status: draft`, and a
  price and a listing text that fit the photo.
- Hint: If the price or the text does not fit, open the session file or
  `npm run agent:web` and look at what each tool returned.
- Docs: https://adk.dev/events/
