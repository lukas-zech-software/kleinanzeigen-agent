import { AgentTool, LlmAgent } from '@google/adk';
import { GEMINI_MODEL } from '../config.js';
import { createListingDraftTool } from '../tools/create-listing-draft.js';
import { priceEvaluatorAgent } from './price-evaluator.js';
import { visionInspectorAgent } from './vision-inspector.js';

const instruction = `You prepare a classified listing for the item in one photo and save it as a draft.

Work through these steps in order:

1. Call vision_inspector to get a description of the item. It reads the photo itself.
2. Call price_evaluator. Ask in one full sentence that names the item, its condition and Germany, like this: What do second-hand listings for a used Nintendo Game Boy DMG-01 currently sell for in Germany?
3. Write the listing in German. The title has at most 65 characters, with brand and model first. The description has three to six sentences, is honest about the condition, and names every visible defect. No contact details and no emojis.
4. Call create_listing_draft once with the title, the recommended price and its currency, the category, the condition, and the description.
5. Answer with one sentence that names the path of the draft file the tool returned.

Stop when a tool returns nothing, an error, or a result with the status "error". Call no further tool and do not try again. Never make up what a tool did not return. Answer with one sentence that says which step failed and repeats the message of the tool, if it gave one.`;

export const listingAgent = new LlmAgent({
  name: 'listing_agent',
  description:
    'Prepares a classified listing for the item in a photo and saves it as a draft for a person to review.',
  model: GEMINI_MODEL,
  instruction,
  tools: [
    new AgentTool({ agent: visionInspectorAgent }),
    new AgentTool({ agent: priceEvaluatorAgent }),
    createListingDraftTool,
  ],
});
