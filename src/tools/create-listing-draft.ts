import { stat } from 'node:fs/promises';
import path from 'node:path';
import { FunctionTool, type Context } from '@google/adk';
import { z } from 'zod';
import { DraftExistsError, listingDraftSchema, writeDraft } from '../draft/draft-file.js';
import { PHOTO_PATH_KEY } from '../session-state.js';

export const createListingDraftInputSchema = z.object({
  title: z
    .string()
    .min(1)
    .describe('Listing title with brand and model first, at most 65 characters.'),
  price: listingDraftSchema.shape.price.describe(
    'Asking price as a number, without a currency sign.',
  ),
  currency: z.string().min(1).describe('ISO 4217 code of the price currency, for example "EUR".'),
  category: z.string().min(1).describe('Category of the item, as vision_inspector returned it.'),
  condition: listingDraftSchema.shape.condition.describe(
    'Condition of the item: "new", "used" or "defective".',
  ),
  description: z
    .string()
    .min(1)
    .describe(
      'The listing text for the buyer, as plain text. Separate paragraphs by a blank line.',
    ),
});

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

export async function createListingDraft(
  input: CreateListingDraftInput,
  toolContext?: DraftToolContext,
): Promise<CreateListingDraftOutput> {
  const photoPath = toolContext?.state.get<unknown>(PHOTO_PATH_KEY);
  if (typeof photoPath !== 'string' || photoPath === '') {
    return {
      status: 'error',
      message: `The session state has no photo path under "${PHOTO_PATH_KEY}".`,
    };
  }
  const photo = await stat(photoPath).catch(() => undefined);
  if (!photo?.isFile()) {
    return { status: 'error', message: `The photo does not exist: ${photoPath}` };
  }

  try {
    const draftPath = await writeDraft(photoPath, {
      ...input,
      image: path.basename(photoPath),
      status: 'draft',
    });
    return { status: 'success', draftPath };
  } catch (error) {
    if (error instanceof DraftExistsError) {
      return { status: 'error', message: `${error.message}. It was not overwritten.` };
    }
    throw error;
  }
}

export const createListingDraftTool = new FunctionTool({
  name: 'create_listing_draft',
  description:
    'Saves the listing as a draft file beside the photo, for a person to review. Fails when a draft already exists.',
  parameters: createListingDraftInputSchema,
  execute: createListingDraft,
});
