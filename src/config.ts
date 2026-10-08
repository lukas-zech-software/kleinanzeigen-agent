import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ quiet: true });

/** Gemini model used by every tool. Override with GEMINI_MODEL in .env. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';

/** Returns a Gemini client, or throws a readable error when no API key is configured. */
export function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
  return new GoogleGenAI({ apiKey });
}
