import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { FunctionTool } from '@google/adk';
import { createPartFromBase64, createPartFromUri, createUserContent } from '@google/genai';
import { z } from 'zod';
import { GEMINI_MODEL, getGenAI } from '../config.js';

export const visionInspectorInputSchema = z.object({
  imagePath: z.string().describe('Local file path or gs:// URI of the item photo.'),
  mimeType: z
    .string()
    .optional()
    .describe(
      'MIME type of the image, e.g. "image/jpeg". Inferred from the file extension when omitted.',
    ),
});

export const visionInspectorOutputSchema = z.object({
  title: z.string().describe('Suggested listing title, at most 65 characters.'),
  detectedCategory: z.string().describe('Product category, e.g. "Smartphones".'),
  condition: z.enum(['new', 'used', 'defective']).describe('Visible condition of the item.'),
  keyAttributes: z
    .array(z.string())
    .describe('Brand, model, color and other distinguishing attributes.'),
});

export type VisionInspectorInput = z.infer<typeof visionInspectorInputSchema>;
export type VisionInspectorOutput = z.infer<typeof visionInspectorOutputSchema>;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

const PROMPT =
  'You inspect a photo of a single item that will be sold second-hand. ' +
  'Describe the item as JSON that matches the response schema.';

export async function inspectImage(input: VisionInspectorInput): Promise<VisionInspectorOutput> {
  const mimeType = input.mimeType ?? MIME_TYPE_BY_EXTENSION[extname(input.imagePath).toLowerCase()];
  if (!mimeType) {
    throw new Error(
      `Cannot infer the MIME type of "${input.imagePath}". Pass mimeType explicitly.`,
    );
  }

  const imagePart = input.imagePath.startsWith('gs://')
    ? createPartFromUri(input.imagePath, mimeType)
    : createPartFromBase64((await readFile(input.imagePath)).toString('base64'), mimeType);

  // Gemini accepts JSON Schema keywords but not the "$schema" dialect marker.
  const { $schema: _dialect, ...responseJsonSchema } = z.toJSONSchema(visionInspectorOutputSchema);

  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: createUserContent([imagePart, PROMPT]),
    config: { responseMimeType: 'application/json', responseJsonSchema },
  });
  if (!response.text) {
    throw new Error('Gemini returned no text for the image.');
  }
  return visionInspectorOutputSchema.parse(JSON.parse(response.text));
}

export const visionInspectorTool = new FunctionTool({
  name: 'vision_inspector',
  description:
    'Analyzes a photo of an item and returns a suggested title, category, condition and key attributes.',
  parameters: visionInspectorInputSchema,
  execute: inspectImage,
});
