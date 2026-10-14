import { LlmAgent, type SingleAgentCallback } from '@google/adk';
import { GEMINI_MODEL } from '../config.js';

/** An answer the agent gives without asking the model. */
function answerWithoutModel(text: string) {
  return { role: 'model', parts: [{ text }] };
}

// TODO(ch03-4): Stop before the model when no person has approved the draft.
// A before-agent callback runs before the agent does anything. When it
// returns an answer, the agent stops with that answer and the model is never
// called. Read the draft path from the session state with `DRAFT_PATH_KEY`,
// and read the draft with `readDraft` from `../draft/read-draft.js`. Return
// `answerWithoutModel(...)` with a sentence that says what is wrong when the
// path is missing, the draft cannot be read (`DraftFormatError`), or its
// status is not `freigegeben`. Otherwise store the draft in the session state
// under `LISTING_KEY` and return `undefined`, so that the agent goes on. A
// rule the agent must never break belongs in code like this, not in the
// instruction.
export const requireApprovedDraft: SingleAgentCallback = async (context) => {
  throw new Error('requireApprovedDraft is not implemented yet (TODO ch03-4).');
};

// TODO(ch03-5): Complete the agent.
// Add a `description`, the `instruction`, `prepareListingTool` from
// `../tools/prepare-listing.js` as its only tool, and `requireApprovedDraft`
// as `beforeAgentCallback`. In the instruction, `{listing}` is replaced by
// the approved listing from the session state, as JSON: it is the only pair
// of curly braces you may use. Tell the agent to read the listing critically,
// to call `prepare_listing` exactly once, and to answer with the package path
// and what the person should check, or with the problems the tool returned.
// It must never claim that the listing was posted.
export const publisherAgent = new LlmAgent({
  name: 'publisher_agent',
  model: GEMINI_MODEL,
});
