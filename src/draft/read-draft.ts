import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
import { listingDraftSchema, type ListingDraft } from './draft-file.js';

/** Thrown when a file is not a readable listing draft. The message says what is wrong. */
export class DraftFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftFormatError';
  }
}

export function parseDraft(content: string): ListingDraft {
  // A person may have edited the draft on Windows.
  const text = content.replace(/\r\n/g, '\n');
  if (!text.startsWith('---\n')) {
    throw new DraftFormatError('The draft does not start with a frontmatter block (---).');
  }
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new DraftFormatError('The frontmatter block is not closed with a --- line.');
  }

  let frontmatter: unknown;
  try {
    frontmatter = parse(text.slice(4, end + 1));
  } catch {
    throw new DraftFormatError('The frontmatter is not valid YAML.');
  }
  if (typeof frontmatter !== 'object' || frontmatter === null || Array.isArray(frontmatter)) {
    throw new DraftFormatError('The frontmatter has no fields.');
  }

  const result = listingDraftSchema.safeParse({
    ...frontmatter,
    description: text.slice(end + 5).trim(),
  });
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new DraftFormatError(
      `The field "${issue.path.join('.')}" is not valid: ${issue.message}`,
    );
  }
  return result.data;
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
