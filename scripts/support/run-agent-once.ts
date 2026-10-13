import {
  InMemoryRunner,
  isFinalResponse,
  stringifyContent,
  type Event,
  type LlmAgent,
} from '@google/adk';

const APP_NAME = 'kleinanzeigen-agent';
const USER_ID = 'local-user';

/**
 * Runs an agent for one user message and returns the events and the final text.
 * Throws when an event carries an error. ADK reports a failed model call and an error thrown in a
 * callback this way, and neither must look like an empty answer.
 */
export async function runAgentOnce(
  agent: LlmAgent,
  options: { message: string; state?: Record<string, unknown> },
): Promise<{ events: Event[]; finalText: string }> {
  const runner = new InMemoryRunner({ agent, appName: APP_NAME });
  const session = await runner.sessionService.createSession({
    appName: APP_NAME,
    userId: USER_ID,
    state: options.state,
  });

  const events: Event[] = [];
  let finalText = '';
  for await (const event of runner.runAsync({
    userId: USER_ID,
    sessionId: session.id,
    newMessage: { role: 'user', parts: [{ text: options.message }] },
  })) {
    if (event.errorCode || event.errorMessage) {
      throw new Error(
        `The agent run failed: ${[event.errorCode, event.errorMessage].filter(Boolean).join(' ')}`,
      );
    }
    events.push(event);
    if (isFinalResponse(event)) {
      finalText = stringifyContent(event).trim();
    }
  }
  return { events, finalText };
}
