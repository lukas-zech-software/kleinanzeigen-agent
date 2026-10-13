import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { z } from 'zod';
import { visionInspectorOutputSchema } from '../agents/vision-inspector.js';

/**
 * A listing draft: the frontmatter fields and the listing text.
 * `status` is `draft` when the agent writes the file. A person changes it to
 * `freigegeben` (German for "approved") after the review.
 */
export const listingDraftSchema = z.object({
  title: z.string().min(1),
  // `.min()` and not `.positive()`: the tool's input reuses this field, and ADK turns `.positive()`
  // into a schema field the Gemini API rejects.
  price: z.number().min(0.01),
  currency: z.string().min(1),
  category: z.string().min(1),
  condition: visionInspectorOutputSchema.shape.condition,
  image: z.string().min(1),
  status: z.enum(['draft', 'freigegeben']),
  description: z.string().min(1),
});

export type ListingDraft = z.infer<typeof listingDraftSchema>;

/** Thrown by `writeDraft` when the draft file is already there. */
export class DraftExistsError extends Error {
  constructor(readonly draftPath: string) {
    super(`A draft already exists: ${draftPath}`);
    this.name = 'DraftExistsError';
  }
}

/** Returns the path of the draft that belongs to a photo: same folder, same name, `.md`. */
export function draftPathFor(photoPath: string): string {
  const { dir, name } = path.parse(photoPath);
  return path.join(dir, `${name}.md`);
}

/** Renders a draft as Markdown: YAML frontmatter, then the listing text. */
export function renderDraft(draft: ListingDraft): string {
  const { description, ...frontmatter } = draft;
  return `---\n${stringify(frontmatter, { lineWidth: 0 })}---\n\n${description.trim()}\n`;
}

/**
 * Validates a draft and writes it beside the photo. Returns the draft path.
 * Throws `DraftExistsError` when the file exists: a draft is never overwritten,
 * because a person may already have edited or approved it.
 */
export async function writeDraft(photoPath: string, draft: ListingDraft): Promise<string> {
  const draftPath = draftPathFor(photoPath);
  const content = renderDraft(listingDraftSchema.parse(draft));
  try {
    await writeFile(draftPath, content, { flag: 'wx' });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new DraftExistsError(draftPath);
    }
    throw error;
  }
  return draftPath;
}
