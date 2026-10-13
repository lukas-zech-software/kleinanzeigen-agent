import type { Session } from '@google/adk';

/**
 * One tool call of an agent run. The field names are the ones ADK's eval items use
 * (`expected_tool_use`), so that the expected calls of this chapter can become an eval set.
 */
export type ToolCall = { tool_name: string; tool_input: Record<string, unknown> };

// TODO(ch02-5): Read what the agent did from a session.
// `adk run --save_session` writes a session file with every event of a run.
// Return the tool calls of the session, in order. An event holds a function
// call as a part of its content, and `getFunctionCalls` from `@google/adk`
// reads them from an event. A call has a `name` and its `args`.
export function toolCallsOf(session: Pick<Session, 'events'>): ToolCall[] {
  throw new Error('toolCallsOf is not implemented yet (TODO ch02-5).');
}
