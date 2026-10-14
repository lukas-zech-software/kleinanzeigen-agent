import type { ListingDraft } from '../draft/draft-file.js';

/** The longest title the listing platform accepts. */
export const MAX_TITLE_LENGTH = 65;

/** One reason why a listing cannot be posted, with the field it concerns. */
export type Problem = { field: string; message: string };

// TODO(ch03-2): Check a listing before it leaves the system.
// Return one `Problem` for each rule the draft breaks, and an empty list when
// it breaks none: the status must be `freigegeben`, the title must have at
// most `MAX_TITLE_LENGTH` characters, and the image must exist as a file. The
// image path in a draft is relative to the folder of the draft, which you get
// as `draftDirectory`. Name the field in `field` and say in `message` what is
// wrong and what the limit is, so that a person can fix the draft.
export async function findProblems(
  draft: ListingDraft,
  draftDirectory: string,
): Promise<Problem[]> {
  throw new Error('findProblems is not implemented yet (TODO ch03-2).');
}
