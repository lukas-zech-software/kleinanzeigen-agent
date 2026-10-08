import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { GEMINI_MODEL, getGenAI } from '../config.js';

export const priceEvaluatorInputSchema = z.object({
  itemQuery: z
    .string()
    .describe('Search terms for the item, e.g. "Logitech MX Keys keyboard black".'),
  condition: z.enum(['new', 'used', 'defective']).describe('Condition of the item being sold.'),
});

export const priceEvaluatorOutputSchema = z.object({
  priceMin: z.number().nonnegative().describe('Lower end of the realistic used price range.'),
  priceMax: z.number().nonnegative().describe('Upper end of the realistic used price range.'),
  recommendedPrice: z.number().nonnegative().describe('Price to list the item at.'),
  currency: z.string().describe('ISO 4217 currency code, e.g. "EUR".'),
});

export type PriceEvaluatorInput = z.infer<typeof priceEvaluatorInputSchema>;
export type PriceEvaluatorOutput = z.infer<typeof priceEvaluatorOutputSchema>;

export async function evaluatePrice(input: PriceEvaluatorInput): Promise<PriceEvaluatorOutput> {
  const prompt =
    `Search for current second-hand listings in Germany for: ${input.itemQuery} (condition: ${input.condition}). ` +
    'Answer with one JSON object and nothing else, using the keys ' +
    'priceMin, priceMax, recommendedPrice (numbers) and currency (ISO 4217 code).';

  // Search grounding cannot be combined with a response schema on every model,
  // so the JSON is requested in the prompt and validated with Zod afterwards.
  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const json = response.text?.match(/\{[\s\S]*\}/)?.[0];
  if (!json) {
    throw new Error('Gemini returned no JSON price estimate.');
  }
  return priceEvaluatorOutputSchema.parse(JSON.parse(json));
}

export const priceEvaluatorTool = new FunctionTool({
  name: 'price_evaluator',
  description: 'Researches a realistic second-hand price range for an item in a given condition.',
  parameters: priceEvaluatorInputSchema,
  execute: evaluatePrice,
});
