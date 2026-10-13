import { LlmAgent, type SingleBeforeModelCallback } from '@google/adk';
import { z } from 'zod';
import { GEMINI_MODEL } from '../config.js';

// TODO(ch01-1): Define what the vision agent answers with.
// It needs `title` (a listing title suggestion), `detectedCategory`,
// `condition` (one of "new", "used", "defective") and `keyAttributes` (an
// array of strings such as brand, model, color). Give every field a
// `.describe()` text: the model reads the schema.
export const visionInspectorOutputSchema = z.object({});

export type VisionInspectorOutput = z.infer<typeof visionInspectorOutputSchema>;

// TODO(ch01-2): Give the model the photo.
// A before-model callback runs just before ADK sends a request to the model.
// Read the photo path from the session state: `context.state.get(...)` with
// `PHOTO_PATH_KEY` from `../session-state.js`. Get the image part from
// `photoPartFor` in `../photo.js` and add it to `request.contents` as a user
// message. When the state has no photo path, throw an error that names the
// key. Return `undefined`, so that the model call goes ahead.
export const addPhotoToRequest: SingleBeforeModelCallback = async ({ context, request }) => {
  throw new Error('The photo callback is not implemented yet (TODO ch01-2).');
};

// TODO(ch01-3): Complete the agent.
// Add a `description` (what the agent does, for other agents that may call
// it), an `instruction` (what it should do with the photo), and the
// `outputSchema` from above. The name, the model and the callback are set.
export const visionInspectorAgent = new LlmAgent({
  name: 'vision_inspector',
  model: GEMINI_MODEL,
  beforeModelCallback: addPhotoToRequest,
});
