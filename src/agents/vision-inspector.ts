import { LlmAgent, type SingleBeforeModelCallback } from '@google/adk';
import { z } from 'zod';
import { GEMINI_MODEL } from '../config.js';
import { photoPartFor } from '../photo.js';
import { PHOTO_PATH_KEY } from '../session-state.js';

export const visionInspectorOutputSchema = z.object({
  title: z.string().describe('Suggested listing title with brand and model first.'),
  detectedCategory: z.string().describe('Category of the item, for example "Handheld Consoles".'),
  condition: z.enum(['new', 'used', 'defective']).describe('Visible condition of the item.'),
  keyAttributes: z
    .array(z.string())
    .describe('Brand, model, color and other attributes a buyer would search for.'),
});

export type VisionInspectorOutput = z.infer<typeof visionInspectorOutputSchema>;

export const addPhotoToRequest: SingleBeforeModelCallback = async ({ context, request }) => {
  const photoPath = context.state.get<unknown>(PHOTO_PATH_KEY);
  if (typeof photoPath !== 'string' || photoPath === '') {
    throw new Error(`The session state has no photo path under "${PHOTO_PATH_KEY}".`);
  }
  request.contents.push({ role: 'user', parts: [await photoPartFor(photoPath)] });
  return undefined;
};

export const visionInspectorAgent = new LlmAgent({
  name: 'vision_inspector',
  description:
    'Looks at the photo of the item and describes it: a title, the category, the condition and key attributes. It reads the photo itself and needs no file path.',
  model: GEMINI_MODEL,
  instruction:
    'You inspect one photo of an item that will be sold second-hand. Describe only what the photo shows. ' +
    'Name brand and model when you can read or recognise them. Judge the condition from visible wear and damage.',
  outputSchema: visionInspectorOutputSchema,
  beforeModelCallback: addPhotoToRequest,
});
