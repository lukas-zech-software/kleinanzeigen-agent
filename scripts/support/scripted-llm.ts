import {
  BaseLlm,
  type BaseLlmConnection,
  type LlmAgent,
  type LlmRequest,
  type LlmResponse,
} from '@google/adk';

/** What the scripted model received: the conversation and the request configuration. */
export type RecordedRequest = Pick<LlmRequest, 'contents' | 'config'>;

/** Every request the scripted model received, in order. */
export const recordedRequests: RecordedRequest[] = [];

const answers: string[] = [];

/** Queues the texts the scripted model answers with, one for each model call. */
export function scriptAnswers(...texts: string[]): void {
  answers.push(...texts);
}

/** Forgets the recorded requests and the queued answers. */
export function resetScriptedModel(): void {
  recordedRequests.length = 0;
  answers.length = 0;
}

/**
 * A model that calls no API. It records each request and answers with the next queued text.
 * An offline test uses it to check what an agent would send to Gemini.
 */
class ScriptedLlm extends BaseLlm {
  constructor() {
    // The name starts with "gemini-" because ADK's GOOGLE_SEARCH tool accepts no other model.
    super({ model: 'gemini-scripted' });
  }

  async *generateContentAsync(request: LlmRequest): AsyncGenerator<LlmResponse, void> {
    // A copy, so that later changes to the request do not alter the record.
    recordedRequests.push(
      JSON.parse(JSON.stringify({ contents: request.contents, config: request.config })),
    );
    const text = answers.shift();
    if (text === undefined) {
      throw new Error('The scripted model has no answer left. Call scriptAnswers() first.');
    }
    yield { content: { role: 'model', parts: [{ text }] }, turnComplete: true };
  }

  async connect(): Promise<BaseLlmConnection> {
    throw new Error('The scripted model has no live connection.');
  }
}

const scriptedModel = new ScriptedLlm();

/**
 * Replaces the model of each agent with the scripted model, for this process only.
 * After this call the agents send no request to Gemini.
 */
export function useScriptedModel(...agents: LlmAgent[]): void {
  for (const agent of agents) {
    agent.model = scriptedModel;
  }
}
