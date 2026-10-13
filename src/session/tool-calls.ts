import { getFunctionCalls, type Session } from '@google/adk';

/**
 * One tool call of an agent run. The field names are the ones ADK's eval items use
 * (`expected_tool_use`), so that the expected calls of this chapter can become an eval set.
 */
export type ToolCall = { tool_name: string; tool_input: Record<string, unknown> };

export function toolCallsOf(session: Pick<Session, 'events'>): ToolCall[] {
  return session.events.flatMap((event) =>
    getFunctionCalls(event).map((call) => ({
      tool_name: call.name ?? '',
      tool_input: call.args ?? {},
    })),
  );
}
