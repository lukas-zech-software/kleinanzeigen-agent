import { FunctionTool, type Context } from '@google/adk';
import { z } from 'zod';
import type { Problem } from '../listing/rules.js';

/** The tool takes no arguments. The draft path comes from the session state. */
export const prepareListingInputSchema = z.object({});

/** Result of the tool call: the path of the package, or the problems that stopped it. */
export type PrepareListingOutput =
  { status: 'success'; packagePath: string } | { status: 'error'; problems: Problem[] };

/** The part of ADK's tool context that this tool uses: the session state. */
export type PrepareToolContext = Pick<Context, 'state'>;

// TODO(ch03-3): Validate the draft and write the package.
// Read the draft path from the session state with `DRAFT_PATH_KEY` from
// `../session-state.js`. Read the draft with `readDraft` from
// `../draft/read-draft.js`, and check it with `findProblems` from
// `../listing/rules.js`: the folder of the draft is `path.dirname(draftPath)`.
// When there is no problem, write the package with `writePackage` from
// `../listing/package-file.js` and return its path. Return an error result
// with the problems otherwise. A missing path and a `DraftFormatError` are
// problems too: return them as a result, under the fields `draft_path` and
// `draft`. The tool reads the file itself and does not trust what the agent
// was told about the listing: this is the last check before a person posts.
export async function prepareListing(
  _input: z.infer<typeof prepareListingInputSchema>,
  toolContext?: PrepareToolContext,
): Promise<PrepareListingOutput> {
  throw new Error('prepareListing is not implemented yet (TODO ch03-3).');
}

export const prepareListingTool = new FunctionTool({
  name: 'prepare_listing',
  description:
    'Checks the approved listing draft against the listing rules and writes the ready-to-post package beside it. Takes no arguments. Returns the package path, or the problems with the field each one concerns.',
  parameters: prepareListingInputSchema,
  execute: prepareListing,
});
