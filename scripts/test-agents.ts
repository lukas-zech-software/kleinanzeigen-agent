import { statSync } from 'node:fs';
import path from 'node:path';
import { LogLevel, setLogLevel } from '@google/adk';
import { parsePriceAnswer, priceEvaluatorAgent } from '../src/agents/price-evaluator.js';
import {
  visionInspectorAgent,
  visionInspectorOutputSchema,
} from '../src/agents/vision-inspector.js';
import { PHOTO_PATH_KEY } from '../src/session-state.js';
import { runAgentOnce } from './support/run-agent-once.js';

// ADK logs every model request at INFO. Show warnings and errors only.
setLogLevel(LogLevel.WARN);

const argument = process.argv[2];
if (!argument) {
  console.error('Usage: npm run test:agents -- <path-to-photo>');
  process.exit(1);
}
if (!statSync(argument, { throwIfNoEntry: false })?.isFile()) {
  console.error(`Photo not found, or not a file: ${argument}`);
  process.exit(1);
}

console.log(`Agents under test: ${visionInspectorAgent.name}, ${priceEvaluatorAgent.name}`);

const vision = await runAgentOnce(visionInspectorAgent, {
  message: 'Describe the item in the photo.',
  state: { [PHOTO_PATH_KEY]: path.resolve(argument) },
});
const item = visionInspectorOutputSchema.parse(JSON.parse(vision.finalText));
console.log('VisionInspectorAgent result:', item);

// The schema is empty in the starter, so the fields are read untyped here.
const fields = item as Record<string, unknown>;
// A full sentence, not a bare item name: that is what makes the model search.
const price = await runAgentOnce(priceEvaluatorAgent, {
  message: `What do second-hand listings for "${fields.title}" in ${fields.condition} condition currently sell for in Germany?`,
});
console.log('PriceEvaluatorAgent result:', parsePriceAnswer(price.finalText));

// A plausible price proves nothing. The search queries prove that the model searched.
const searchQueries = price.events.flatMap(
  (event) => event.groundingMetadata?.webSearchQueries ?? [],
);
console.log('Search queries:', searchQueries);
if (searchQueries.length === 0) {
  console.error('The price agent answered without a Google Search. Its price is from memory.');
  process.exit(1);
}
