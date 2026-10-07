import { existsSync } from 'node:fs';
import '../src/config.js';
import {
  evaluatePrice,
  priceEvaluatorInputSchema,
  priceEvaluatorOutputSchema,
  priceEvaluatorTool,
} from '../src/tools/price-evaluator.js';
import {
  inspectImage,
  visionInspectorInputSchema,
  visionInspectorOutputSchema,
  visionInspectorTool,
} from '../src/tools/vision-inspector.js';

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: npm run test:tools -- <path-to-image>');
  process.exit(1);
}
if (!imagePath.startsWith('gs://') && !existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}`);
  process.exit(1);
}

console.log(`Tools under test: ${visionInspectorTool.name}, ${priceEvaluatorTool.name}`);

const visionInput = visionInspectorInputSchema.parse({ imagePath });
const vision = visionInspectorOutputSchema.parse(await inspectImage(visionInput));
console.log('VisionInspectorTool result:', vision);

// The schemas are empty in the starter, so the fields are read untyped here.
const fields = vision as Record<string, unknown>;
const attributes = Array.isArray(fields.keyAttributes) ? fields.keyAttributes : [];
const priceInput = priceEvaluatorInputSchema.parse({
  itemQuery: [fields.title, ...attributes].filter(Boolean).join(' '),
  condition: fields.condition,
});
const price = priceEvaluatorOutputSchema.parse(await evaluatePrice(priceInput));
console.log('PriceEvaluatorTool result:', price);
