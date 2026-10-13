import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Reads a local photo and returns it as an image part for a model request.
 * Throws a readable error when the file type is not supported or the file is missing.
 */
export async function photoPartFor(photoPath: string) {
  const mimeType = MIME_TYPES[path.extname(photoPath).toLowerCase()];
  if (!mimeType) {
    throw new Error(`Unsupported photo type: ${photoPath}. Use a .jpg, .jpeg, .png or .webp file.`);
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(photoPath);
  } catch {
    throw new Error(`Photo not found: ${photoPath}`);
  }
  return { inlineData: { mimeType, data: bytes.toString('base64') } };
}
