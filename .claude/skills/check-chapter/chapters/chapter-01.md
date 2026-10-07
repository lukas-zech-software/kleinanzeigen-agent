# Chapter 1 criteria: Foundation, Setup & Tool Design

Goal: two ADK tools, `VisionInspectorTool` and `PriceEvaluatorTool`, with
typed Zod input and output schemas, turning a photo and a price question into
reliable JSON.

Live test command: `npx tsx scripts/test-tools.ts <path-to-photo>`
Required key: `GEMINI_API_KEY`

## ch01-1 Vision input schema

- Type: static
- Target: `src/tools/vision-inspector.ts`, export `visionInspectorInputSchema`
- Requirement: a Zod object with a string field `imagePath` (a local path or a
  GCS URI) and an optional `mimeType`.
- Hint: The schema is the only description of the arguments the model gets, so
  each field needs a type and a `.describe()` text.
- Docs: https://adk.dev/live/tools/

## ch01-2 Vision output schema

- Type: static
- Target: `src/tools/vision-inspector.ts`, export `visionInspectorOutputSchema`
- Requirement: a Zod object with `title` (string), `detectedCategory`
  (string), `condition` (limited to new, used, defective), and `keyAttributes`
  (array of strings).
- Hint: A closed set of values is an enum, not a free string. That is what
  lets later chapters branch on the condition safely.
- Docs: https://zod.dev/

## ch01-3 Vision extraction

- Type: static
- Target: `src/tools/vision-inspector.ts`, export `inspectImage`
- Requirement: sends the image at `imagePath` to Gemini and returns a value
  parsed with `visionInspectorOutputSchema`. It no longer throws
  "not implemented".
- Hint: A multimodal request is one user message with two parts, the image and
  the instruction. Ask Gemini for JSON and validate what comes back before
  returning it.
- Docs: https://ai.google.dev/gemini-api/docs/image-understanding

## ch01-4 Price input schema

- Type: static
- Target: `src/tools/price-evaluator.ts`, export `priceEvaluatorInputSchema`
- Requirement: a Zod object with `itemQuery` (string) and `condition`.
- Hint: The agent will fill these from the vision result, so use the same set
  of condition values as the vision output.
- Docs: https://adk.dev/live/tools/

## ch01-5 Price output schema

- Type: static
- Target: `src/tools/price-evaluator.ts`, export `priceEvaluatorOutputSchema`
- Requirement: a Zod object with numeric `priceMin`, `priceMax`, and
  `recommendedPrice`, and a `currency`.
- Hint: Prices are numbers, not strings with a currency sign. Keep the
  currency in its own field.
- Docs: https://zod.dev/

## ch01-6 Price research

- Type: static
- Target: `src/tools/price-evaluator.ts`, export `evaluatePrice`
- Requirement: derives a used-price range for `itemQuery` and `condition` from
  a real source (for example Gemini with Google Search grounding) and returns
  a value parsed with `priceEvaluatorOutputSchema`. Hard-coded prices do not
  count. It no longer throws "not implemented".
- Hint: Let the model look up current listings instead of guessing from
  memory, then validate its answer like any other untrusted input.
- Docs: https://ai.google.dev/gemini-api/docs/google-search

## ch01-tc Typecheck

- Type: typecheck
- Target: whole project
- Requirement: `npx tsc --noEmit` exits 0.
- Hint: Read the first error only; later ones often follow from it.
- Docs: https://adk.dev/tutorials/multi-tool-agent/

## ch01-live-1 Vision tool returns a valid result

- Type: live
- Target: `scripts/test-tools.ts`
- Requirement: the output contains a `VisionInspectorTool result:` line with
  plausible attributes for the photo, and the script does not fail before it.
- Hint: If parsing fails, compare the keys Gemini returned with your output
  schema.
- Docs: https://ai.google.dev/gemini-api/docs/structured-output

## ch01-live-2 Price tool returns a numeric range

- Type: live
- Target: `scripts/test-tools.ts`
- Requirement: the output contains a `PriceEvaluatorTool result:` line with
  numeric `priceMin`, `priceMax`, and `recommendedPrice`, and the script exits
  0.
- Hint: If the answer is prose instead of JSON, tighten the instruction about
  the output format.
- Docs: https://ai.google.dev/gemini-api/docs/google-search
