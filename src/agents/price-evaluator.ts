import { GOOGLE_SEARCH, LlmAgent } from '@google/adk';
import { z } from 'zod';
import { GEMINI_MODEL } from '../config.js';

export const priceEvaluatorOutputSchema = z.object({
  priceMin: z.number().min(0).describe('Lowest realistic second-hand price.'),
  priceMax: z.number().min(0).describe('Highest realistic second-hand price.'),
  recommendedPrice: z.number().min(0).describe('Price to ask for a quick, fair sale.'),
  currency: z.string().min(1).describe('ISO 4217 code of the prices, for example "EUR".'),
});

export type PriceEvaluatorOutput = z.infer<typeof priceEvaluatorOutputSchema>;

export const priceEvaluatorAgent = new LlmAgent({
  name: 'price_evaluator',
  description:
    'Researches what an item currently sells for second-hand. Ask it in a full sentence that names the item and its condition.',
  model: GEMINI_MODEL,
  instruction:
    'You research what an item currently sells for second-hand in Germany. ' +
    'Always run a Google Search for current listings and sold items first. Never answer from memory. ' +
    'Then say in one or two sentences what you found. ' +
    'End your answer with one JSON object and write nothing after it. ' +
    'The object has the numbers priceMin, priceMax and recommendedPrice, and the string currency with the ISO 4217 code.',
  tools: [GOOGLE_SEARCH],
});

export function parsePriceAnswer(text: string): PriceEvaluatorOutput {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) {
    throw new Error('The price answer contains no JSON object.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The JSON object in the price answer cannot be parsed.');
  }
  return priceEvaluatorOutputSchema.parse(value);
}
