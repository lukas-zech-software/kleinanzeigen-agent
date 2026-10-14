import { LlmAgent, type SingleAgentCallback } from '@google/adk';
import { GEMINI_MODEL } from '../config.js';
import { DraftFormatError, readDraft } from '../draft/read-draft.js';
import { DRAFT_PATH_KEY, LISTING_KEY } from '../session-state.js';
import { prepareListingTool } from '../tools/prepare-listing.js';

/** An answer the agent gives without asking the model. */
function answerWithoutModel(text: string) {
  return { role: 'model', parts: [{ text }] };
}

export const requireApprovedDraft: SingleAgentCallback = async (context) => {
  const draftPath = context.state.get<unknown>(DRAFT_PATH_KEY);
  if (typeof draftPath !== 'string' || draftPath === '') {
    return answerWithoutModel(
      `The session state has no draft path under "${DRAFT_PATH_KEY}". Nothing was prepared.`,
    );
  }

  let draft;
  try {
    draft = await readDraft(draftPath);
  } catch (error) {
    if (error instanceof DraftFormatError) {
      return answerWithoutModel(
        `The draft ${draftPath} cannot be read. ${error.message} Nothing was prepared.`,
      );
    }
    throw error;
  }

  if (draft.status !== 'freigegeben') {
    return answerWithoutModel(
      `The draft ${draftPath} is not approved. Its status is "${draft.status}". A person has to set it to "freigegeben" first. Nothing was prepared.`,
    );
  }

  context.state.set(LISTING_KEY, draft);
  return undefined;
};

const instruction = `You hand an approved classified listing over to the person who posts it. You never post it yourself.

This is the listing, as JSON: {listing}

Work through these steps in order:

1. Read the listing as a buyer would. Note where the description does not fit the title, the condition or the price, and whether it contains contact details.
2. Call prepare_listing once, without arguments. It checks the listing rules and writes the package. Call it also when you noted something in step 1: the tool decides whether the listing can be posted.
3. Answer in English. When the tool returned a package path, name the path, and then list in at most three short bullet points what the person should look at before posting, starting with what you noted in step 1. When the tool returned problems, say that nothing was prepared and name each field with its problem.

Never say that the listing was posted.`;

export const publisherAgent = new LlmAgent({
  name: 'publisher_agent',
  description:
    'Checks an approved listing draft and prepares the package a person uses to post it. It never posts.',
  model: GEMINI_MODEL,
  instruction,
  tools: [prepareListingTool],
  beforeAgentCallback: requireApprovedDraft,
});
