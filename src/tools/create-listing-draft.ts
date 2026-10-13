import { FunctionTool, type Context } from '@google/adk';
import { z } from 'zod';

// TODO(ch02-1): Define the input schema of the create_listing_draft tool.
// It needs `title`, `price`, `currency`, `category`, `condition` and
// `description`, each with a `.describe()` text. `listingDraftSchema` in
// `../draft/draft-file.js` already holds the rules for `price` and
// `condition`, and `listingDraftSchema.shape` lets you reuse a field. Do not
// add a field for a file path: the model must not decide where a file is
// written.
export const createListingDraftInputSchema = z.object({});

/**
 * Result of the tool call. This `status` says whether the call worked. It is
 * not the `status` field in the frontmatter of the draft.
 */
export const createListingDraftOutputSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), draftPath: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);

export type CreateListingDraftInput = z.infer<typeof createListingDraftInputSchema>;
export type CreateListingDraftOutput = z.infer<typeof createListingDraftOutputSchema>;

/** The part of ADK's tool context that this tool uses: the session state. */
export type DraftToolContext = Pick<Context, 'state'>;

// TODO(ch02-2): Save the draft beside the photo.
// Read the photo path from the session state: `toolContext.state.get(...)`
// with `PHOTO_PATH_KEY` from `../session-state.js`. Return an error result
// when there is no usable path or the photo file does not exist. Otherwise
// call `writeDraft` from `../draft/draft-file.js` with the input, `image`
// (the file name of the photo) and `status: 'draft'`, and return a success
// result with the draft path. `writeDraft` throws `DraftExistsError` when a
// draft is already there: turn that into an error result too. An expected
// failure is a result the agent can report, not an exception.
export async function createListingDraft(
  input: CreateListingDraftInput,
  toolContext?: DraftToolContext,
): Promise<CreateListingDraftOutput> {
  throw new Error('createListingDraft is not implemented yet (TODO ch02-2).');
}

export const createListingDraftTool = new FunctionTool({
  name: 'create_listing_draft',
  description:
    'Saves the listing as a draft file beside the photo, for a person to review. Fails when a draft already exists.',
  parameters: createListingDraftInputSchema,
  execute: createListingDraft,
});
