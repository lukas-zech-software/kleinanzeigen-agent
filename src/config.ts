import dotenv from 'dotenv';

dotenv.config({ quiet: true });

/** Gemini model used by every agent. Override with GEMINI_MODEL in .env. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.8-flash';
