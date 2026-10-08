# Chapter 1: Foundation, Setup & Tool Design

## What you need

- Node.js 26 or newer and npm.
- A Google AI Studio API key, stored in `.env` as `GEMINI_API_KEY`.
- The dependencies from `npm ci`: `@google/adk`, `@google/genai`, `zod`,
  `dotenv`, and `tsx`.
- A photo of an item you could sell for the live test. Take your own or use
  one from [examples/photos](examples/photos/README.md).

## Goal

You build the first two tools of the listing agent:

- `VisionInspectorTool` looks at a photo and describes the item.
- `PriceEvaluatorTool` researches a realistic second-hand price range for it.

An agent can only decide well when its tools have clear, typed interfaces. You
therefore give each tool a Zod schema for its input and one for its output.
After this chapter, a photo and a price question come back as validated JSON
that the agent in chapter 2 can rely on.

## What is already there

- `src/config.ts` loads `.env` and exports `GEMINI_MODEL` (default
  `gemini-3.8-flash`, override it with `GEMINI_MODEL` in `.env`) and
  `getGenAI()`, which returns the Gemini client.
- `src/tools/vision-inspector.ts` and `src/tools/price-evaluator.ts` hold the
  tool definitions with empty schemas and functions that throw.
- `scripts/test-tools.ts` runs both tools against a photo.

The project setup (`package.json`, `tsconfig.json`, ESM) is done for you.

## Your tasks

Each task is marked in the code as `// TODO(ch01-k)`. Delete the comment when
the task is done.

| Task     | File                            | What to do                                                                                                                                |
| -------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ch01-1` | `src/tools/vision-inspector.ts` | Input schema: `imagePath` (a local path or a `gs://` URI) and an optional `mimeType`.                                                     |
| `ch01-2` | `src/tools/vision-inspector.ts` | Output schema: `title`, `detectedCategory`, `condition` (new, used, or defective), and `keyAttributes` (strings such as brand and color). |
| `ch01-3` | `src/tools/vision-inspector.ts` | `inspectImage`: send the image to Gemini with an instruction, ask for JSON, and return it parsed with the output schema.                  |
| `ch01-4` | `src/tools/price-evaluator.ts`  | Input schema: `itemQuery` and `condition`.                                                                                                |
| `ch01-5` | `src/tools/price-evaluator.ts`  | Output schema: the numbers `priceMin`, `priceMax`, and `recommendedPrice`, and a `currency`.                                              |
| `ch01-6` | `src/tools/price-evaluator.ts`  | `evaluatePrice`: get the price range from a real source, for example Gemini with Google Search grounding, and return it parsed.           |

Give every schema field a `.describe()` text. The schema is all the model sees
of a tool's arguments.

## Check your work

```sh
npm run typecheck
npm run test:tools -- examples/photos/game-boy.jpg
```

The chapter is done when:

- `npm run typecheck` reports no errors,
- the test prints a `VisionInspectorTool result:` with plausible attributes
  for your photo, and
- it prints a `PriceEvaluatorTool result:` with a numeric price range.

`test:tools` calls the Gemini API and uses your quota.

In Claude Code, ask "is my chapter done?" for a check against each task, with
a hint for whatever is still open.

## Documentation

- [ADK multi-tool agent tutorial](https://adk.dev/tutorials/multi-tool-agent/)
- [ADK tool concepts and schemas](https://adk.dev/live/tools/)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- [Zod](https://zod.dev/)
