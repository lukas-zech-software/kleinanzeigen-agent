import { FunctionTool } from '@google/adk';
import { z } from 'zod';

// TODO(ch01-1): Define the input schema of the VisionInspectorTool.
// It needs `imagePath` (a local file path or a gs:// URI) and an optional
// `mimeType`. Give every field a `.describe()` text: the schema is all the
// model sees of your tool's arguments.
export const visionInspectorInputSchema = z.object({});

// TODO(ch01-2): Define the output schema of the VisionInspectorTool.
// It needs `title` (a listing title suggestion), `detectedCategory`,
// `condition` (one of "new", "used", "defective") and `keyAttributes`
// (an array of strings such as brand, model, color).
export const visionInspectorOutputSchema = z.object({});

export type VisionInspectorInput = z.infer<typeof visionInspectorInputSchema>;
export type VisionInspectorOutput = z.infer<typeof visionInspectorOutputSchema>;

// TODO(ch01-3): Implement the multimodal extraction.
// Read the image, send it to Gemini together with an instruction, ask for
// JSON that matches the output schema, and return the result parsed with
// `visionInspectorOutputSchema`. `getGenAI()` and `GEMINI_MODEL` from
// `../config.js` give you the client and the model.
export async function inspectImage(input: VisionInspectorInput): Promise<VisionInspectorOutput> {
  throw new Error('inspectImage is not implemented yet (TODO ch01-3).');
}

export const visionInspectorTool = new FunctionTool({
  name: 'vision_inspector',
  description:
    'Analyzes a photo of an item and returns a suggested title, category, condition and key attributes.',
  parameters: visionInspectorInputSchema,
  execute: inspectImage,
});
