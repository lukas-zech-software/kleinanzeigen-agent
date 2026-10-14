import path from 'node:path';
import { FunctionTool, type Context } from '@google/adk';
import { z } from 'zod';
import { DraftFormatError, readDraft } from '../draft/read-draft.js';
import { writePackage } from '../listing/package-file.js';
import { findProblems, type Problem } from '../listing/rules.js';
import { DRAFT_PATH_KEY } from '../session-state.js';

/** The tool takes no arguments. The draft path comes from the session state. */
export const prepareListingInputSchema = z.object({});

/** Result of the tool call: the path of the package, or the problems that stopped it. */
export type PrepareListingOutput =
  { status: 'success'; packagePath: string } | { status: 'error'; problems: Problem[] };

/** The part of ADK's tool context that this tool uses: the session state. */
export type PrepareToolContext = Pick<Context, 'state'>;

export async function prepareListing(
  _input: z.infer<typeof prepareListingInputSchema>,
  toolContext?: PrepareToolContext,
): Promise<PrepareListingOutput> {
  const draftPath = toolContext?.state.get<unknown>(DRAFT_PATH_KEY);
  if (typeof draftPath !== 'string' || draftPath === '') {
    return {
      status: 'error',
      problems: [{ field: DRAFT_PATH_KEY, message: 'The session state has no draft path.' }],
    };
  }

  let draft;
  try {
    draft = await readDraft(draftPath);
  } catch (error) {
    if (error instanceof DraftFormatError) {
      return { status: 'error', problems: [{ field: 'draft', message: error.message }] };
    }
    throw error;
  }

  const problems = await findProblems(draft, path.dirname(draftPath));
  if (problems.length > 0) {
    return { status: 'error', problems };
  }
  return { status: 'success', packagePath: await writePackage(draftPath, draft) };
}

export const prepareListingTool = new FunctionTool({
  name: 'prepare_listing',
  description:
    'Checks the approved listing draft against the listing rules and writes the ready-to-post package beside it. Takes no arguments. Returns the package path, or the problems with the field each one concerns.',
  parameters: prepareListingInputSchema,
  execute: prepareListing,
});
