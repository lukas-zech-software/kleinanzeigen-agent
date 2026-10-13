import { LlmAgent } from '@google/adk';
import { GEMINI_MODEL } from '../config.js';

// TODO(ch02-4): Write the instruction of the listing agent.
// Describe the steps in order: get the description of the item, get a price,
// write the listing, save the draft. The price agent searches only when it is
// asked in a full sentence, so tell the agent to ask that way. Say what the
// agent does when a tool returns nothing or an error: an agent behind
// `AgentTool` that fails returns an empty result, not an error. Ask for a
// final answer that names the draft file. Use no curly braces: ADK reads them
// as placeholders for session state keys.
const instruction = '';

// TODO(ch02-3): Complete the agent.
// Add a `description` and three tools: `visionInspectorAgent` and
// `priceEvaluatorAgent`, each wrapped in `new AgentTool({ agent })` from
// `@google/adk`, and `createListingDraftTool`. `AgentTool` makes an agent
// callable like a tool, under the agent's name.
export const listingAgent = new LlmAgent({
  name: 'listing_agent',
  model: GEMINI_MODEL,
  instruction,
});
