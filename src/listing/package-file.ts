import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ListingDraft } from '../draft/draft-file.js';

/** What the person who posts the listing still has to do. The agent never posts. */
export const HANDOFF_CHECKLIST = [
  'Compare the photo with the title and the description.',
  'Post the listing by hand. The agent does not post it.',
  'After posting, move the draft away, so that it is not prepared a second time.',
];

/** Returns the path of the package that belongs to a draft: same folder, same name, `.listing.json`. */
export function packagePathFor(draftPath: string): string {
  const { dir, name } = path.parse(draftPath);
  return path.join(dir, `${name}.listing.json`);
}

/**
 * Writes the ready-to-post package beside the draft and returns its path.
 * A package can be written again: it is derived from the draft, and the draft is what a person edits.
 */
export async function writePackage(draftPath: string, draft: ListingDraft): Promise<string> {
  const packagePath = packagePathFor(draftPath);
  const listingPackage = {
    title: draft.title,
    price: draft.price,
    currency: draft.currency,
    category: draft.category,
    condition: draft.condition,
    description: draft.description,
    images: [draft.image],
    checklist: HANDOFF_CHECKLIST,
  };
  await writeFile(packagePath, `${JSON.stringify(listingPackage, null, 2)}\n`);
  return packagePath;
}
