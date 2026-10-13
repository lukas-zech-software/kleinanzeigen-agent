# Chapter 1 criteria: Foundation, Setup & Specialist Agents

Goal: two ADK agents. `vision_inspector` describes the item in a photo as
structured output. `price_evaluator` researches a second-hand price range
with Google Search.

Script command: `npm run test:offline`
Live test command: `npx tsx scripts/test-agents.ts <path-to-photo>`
Required key: `GEMINI_API_KEY`

## ch01-1 Vision output schema

- Type: static
- Target: `src/agents/vision-inspector.ts`, export
  `visionInspectorOutputSchema`
- Requirement: a Zod object with `title` (string), `detectedCategory`
  (string), `condition` (limited to new, used, defective), and `keyAttributes`
  (array of strings), each with a `.describe()` text.
- Hint: The model reads the schema, so each field needs a type and a
  description. A closed set of values is an enum, not a free string.
- Docs: https://adk.dev/agents/llm-agents/

## ch01-2 Photo callback

- Type: static
- Target: `src/agents/vision-inspector.ts`, export `addPhotoToRequest`
- Requirement: a before-model callback that reads the photo path from the
  session state, adds the photo to the request as an image part, and fails
  with an error that names `photo_path` when the state has none. It no longer
  throws "not implemented".
- Hint: A callback gets the context and the request. The session state is on
  the context, and the request holds the messages the model will see. The
  model never supplies a file path: the path comes from the state.
- Docs: https://adk.dev/callbacks/types-of-callbacks/

## ch01-3 Vision agent

- Type: static
- Target: `src/agents/vision-inspector.ts`, export `visionInspectorAgent`
- Requirement: an `LlmAgent` named `vision_inspector` with a description, the
  model from `src/config.ts` given as a name, an instruction, the output
  schema, and `addPhotoToRequest` as its before-model callback.
- Hint: The description is for other agents that decide whether to call this
  one. The instruction is for the agent itself. An output schema makes the
  answer a JSON object you can rely on.
- Docs: https://adk.dev/agents/llm-agents/

## ch01-4 Price output schema

- Type: static
- Target: `src/agents/price-evaluator.ts`, export
  `priceEvaluatorOutputSchema`
- Requirement: a Zod object with the numbers `priceMin`, `priceMax`, and
  `recommendedPrice`, and a `currency`, each described.
- Hint: Prices are numbers, not strings with a currency sign. Keep the
  currency in its own field.
- Docs: https://zod.dev/

## ch01-5 Price agent

- Type: static
- Target: `src/agents/price-evaluator.ts`, export `priceEvaluatorAgent`
- Requirement: an `LlmAgent` named `price_evaluator` with a description, the
  model from `src/config.ts` given as a name, and `GOOGLE_SEARCH` as its only
  tool. It has no output schema. Its instruction asks for a search before the
  answer and for one JSON object at the end of the answer.
- Hint: A built-in tool such as Google Search must be the only tool of its
  agent, and the Gemini API does not accept an output schema beside it. That
  is why this agent answers with JSON as text. The model decides whether it
  searches, so the instruction has to make it.
- Docs: https://adk.dev/integrations/google-search/

## ch01-6 Price answer parsing

- Type: static
- Target: `src/agents/price-evaluator.ts`, export `parsePriceAnswer`
- Requirement: finds the JSON object in the agent's text answer, also inside
  a code fence or after prose, returns it validated with
  `priceEvaluatorOutputSchema`, and throws when there is none or it does not
  match. It no longer throws "not implemented".
- Hint: Model output is untrusted input. Validate it with the schema before
  any other code uses it.
- Docs: https://zod.dev/

## ch01-tc Typecheck

- Type: typecheck
- Target: whole project
- Requirement: `npx tsc --noEmit` exits 0.
- Hint: Read the first error only; later ones often follow from it.
- Docs: https://adk.dev/agents/llm-agents/

## ch01-script Offline agent test

- Type: script
- Target: `scripts/test-offline.ts`
- Requirement: `npm run test:offline` exits 0.
- Hint: The failing assertion names its case and says what the request to the
  model should have contained. The test replaces Gemini with a scripted
  model, so it shows what your agent sends, not what Gemini answers.
- Docs: https://adk.dev/callbacks/types-of-callbacks/

## ch01-live-1 The vision agent describes the photo

- Type: live
- Target: `scripts/test-agents.ts`
- Requirement: the output contains a `VisionInspectorAgent result:` line with
  attributes that fit the photo, and the script does not fail before it.
- Hint: If the description is vague, say in the instruction what a buyer
  needs to know.
- Docs: https://adk.dev/agents/llm-agents/

## ch01-live-2 The price agent searches and returns a range

- Type: live
- Target: `scripts/test-agents.ts`
- Requirement: the output contains a `PriceEvaluatorAgent result:` line with
  numeric `priceMin`, `priceMax`, and `recommendedPrice`, at least one entry
  under `Search queries:`, and the script exits 0.
- Hint: An empty `Search queries:` list means the model answered from memory.
  Tell the agent to search first, and keep the request for JSON at the end of
  the instruction.
- Docs: https://adk.dev/grounding/google_search_grounding/
