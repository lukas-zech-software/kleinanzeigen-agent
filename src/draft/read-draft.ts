import { readFile } from 'node:fs/promises';
import type { ListingDraft } from './draft-file.js';

/** Thrown when a file is not a readable listing draft. The message says what is wrong. */
export class DraftFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftFormatError';
  }
}

// TODO(ch03-1): Turn the text of a draft file back into a `ListingDraft`.
// A draft starts with a frontmatter block between two `---` lines, followed by
// the listing text. Parse the block with `parse` from the `yaml` package, add
// the text as `description`, and validate the result with `listingDraftSchema`
// from `./draft-file.js`. Throw a `DraftFormatError` that says what is wrong
// when the block is missing, is not closed, is not valid YAML, or a field does
// not match the schema: name the field in that case. A person edits this file
// by hand, possibly on Windows, so accept `\r\n` line endings.
export function parseDraft(content: string): ListingDraft {
  throw new Error('parseDraft is not implemented yet (TODO ch03-1).');
}

/** Reads a draft file and returns it parsed. Throws `DraftFormatError` when it cannot. */
export async function readDraft(draftPath: string): Promise<ListingDraft> {
  let content: string;
  try {
    content = await readFile(draftPath, 'utf8');
  } catch {
    throw new DraftFormatError(`The draft file does not exist: ${draftPath}`);
  }
  return parseDraft(content);
}
