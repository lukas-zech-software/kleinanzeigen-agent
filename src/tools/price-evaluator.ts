import { FunctionTool } from '@google/adk';
import { z } from 'zod';

// TODO(ch01-4): Define the input schema of the PriceEvaluatorTool.
// It needs `itemQuery` (search terms for the item) and `condition`
// (one of "new", "used", "defective").
export const priceEvaluatorInputSchema = z.object({});

// TODO(ch01-5): Define the output schema of the PriceEvaluatorTool.
// It needs the numbers `priceMin`, `priceMax` and `recommendedPrice`, and a
// `currency` code.
export const priceEvaluatorOutputSchema = z.object({});

export type PriceEvaluatorInput = z.infer<typeof priceEvaluatorInputSchema>;
export type PriceEvaluatorOutput = z.infer<typeof priceEvaluatorOutputSchema>;

// TODO(ch01-6): Implement the price research.
// Find a realistic second-hand price range for the item in its condition and
// return it parsed with `priceEvaluatorOutputSchema`. Use a real source, for
// example Gemini with Google Search grounding, not fixed numbers.
// `getGenAI()` and `GEMINI_MODEL` from `../config.js` give you the client and
// the model.
export async function evaluatePrice(input: PriceEvaluatorInput): Promise<PriceEvaluatorOutput> {
  throw new Error('evaluatePrice is not implemented yet (TODO ch01-6).');
}

export const priceEvaluatorTool = new FunctionTool({
  name: 'price_evaluator',
  description: 'Researches a realistic second-hand price range for an item in a given condition.',
  parameters: priceEvaluatorInputSchema,
  execute: evaluatePrice,
});
