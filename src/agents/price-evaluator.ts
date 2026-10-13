import { LlmAgent } from '@google/adk';
import { z } from 'zod';
import { GEMINI_MODEL } from '../config.js';

// TODO(ch01-4): Define what a price answer looks like.
// It needs the numbers `priceMin`, `priceMax` and `recommendedPrice`, and a
// `currency` code. Describe every field.
export const priceEvaluatorOutputSchema = z.object({});

export type PriceEvaluatorOutput = z.infer<typeof priceEvaluatorOutputSchema>;

// TODO(ch01-5): Complete the agent.
// Add a `description`, `GOOGLE_SEARCH` from `@google/adk` as its only tool,
// and an `instruction`. The instruction has two jobs: make the agent search
// before it answers, and make it end its answer with one JSON object that
// has the fields of the schema above. Do not set an `outputSchema` here: the
// Gemini API rejects it beside Google Search. Describe the JSON in words and
// use no curly braces in the instruction, because ADK reads them as
// placeholders.
export const priceEvaluatorAgent = new LlmAgent({
  name: 'price_evaluator',
  model: GEMINI_MODEL,
});

// TODO(ch01-6): Turn the agent's answer into a checked value.
// The answer is text. Find the JSON object in it (it may sit in a code fence
// or after a sentence), parse it, and return it validated with
// `priceEvaluatorOutputSchema`. Throw when there is no JSON object or it does
// not match the schema. Model output is untrusted input.
export function parsePriceAnswer(text: string): PriceEvaluatorOutput {
  throw new Error('parsePriceAnswer is not implemented yet (TODO ch01-6).');
}
