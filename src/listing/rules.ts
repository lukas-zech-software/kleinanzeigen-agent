import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { ListingDraft } from '../draft/draft-file.js';

/** The longest title the listing platform accepts. */
export const MAX_TITLE_LENGTH = 65;

/** One reason why a listing cannot be posted, with the field it concerns. */
export type Problem = { field: string; message: string };

export async function findProblems(
  draft: ListingDraft,
  draftDirectory: string,
): Promise<Problem[]> {
  const problems: Problem[] = [];
  if (draft.status !== 'freigegeben') {
    problems.push({
      field: 'status',
      message: `The status is "${draft.status}". A person has to set it to "freigegeben" first.`,
    });
  }
  if (draft.title.length > MAX_TITLE_LENGTH) {
    problems.push({
      field: 'title',
      message: `The title has ${draft.title.length} characters. The limit is ${MAX_TITLE_LENGTH}.`,
    });
  }
  const image = await stat(path.resolve(draftDirectory, draft.image)).catch(() => undefined);
  if (!image?.isFile()) {
    problems.push({ field: 'image', message: `The image does not exist: ${draft.image}` });
  }
  return problems;
}
