// Checks the session that `adk run --save_session` wrote for the listing agent.
// ADK's eval runner compares the arguments of a tool call exactly. This agent writes its
// arguments freely, so this script checks the tool names and their order. Chapter 3 uses the runner.
import { existsSync, readFileSync } from 'node:fs';
import { getFunctionResponses, isFinalResponse, stringifyContent, type Session } from '@google/adk';
import { SEARCH_QUERIES_KEY } from '../src/session-state.js';
import { toolCallsOf } from '../src/session/tool-calls.js';

const EXPECTED_FILE = 'examples/expected/listing-agent.json';

const sessionFile = process.argv[2];
if (!sessionFile) {
  console.error('Usage: npm run session:check   (or: tsx scripts/check-session.ts <session-file>)');
  process.exit(1);
}
if (!existsSync(sessionFile)) {
  console.error(`No session file: ${sessionFile}. Run "npm run agent:listing" first.`);
  process.exit(1);
}

const session: Pick<Session, 'events' | 'state'> = JSON.parse(readFileSync(sessionFile, 'utf8'));
const expected: { expected_tool_use: { tool_name: string }[] } = JSON.parse(
  readFileSync(EXPECTED_FILE, 'utf8'),
);

const problems: string[] = [];

for (const event of session.events) {
  if (event.errorCode || event.errorMessage) {
    problems.push(
      `An event carries an error: ${[event.errorCode, event.errorMessage].filter(Boolean).join(' ')}`,
    );
  }
}

const toolCalls = toolCallsOf(session);
console.log('Tool calls:');
for (const call of toolCalls) {
  console.log(`  ${call.tool_name} ${JSON.stringify(call.tool_input)}`);
}
const expectedNames = expected.expected_tool_use.map((call) => call.tool_name);
const actualNames = toolCalls.map((call) => call.tool_name);
if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
  problems.push(
    `Expected the tool calls ${expectedNames.join(', ')} in this order, found ${actualNames.join(', ') || 'none'}.`,
  );
}

const searchQueries = session.state[SEARCH_QUERIES_KEY];
console.log('Search queries:', searchQueries ?? []);
if (!Array.isArray(searchQueries) || searchQueries.length === 0) {
  problems.push('The price agent ran no Google Search. Its price is from memory.');
}

const draftResult = session.events
  .flatMap((event) => getFunctionResponses(event))
  .find((response) => response.name === 'create_listing_draft')?.response;
console.log('Draft result:', draftResult ?? 'none');
if (draftResult?.status !== 'success') {
  problems.push(
    `create_listing_draft did not report a saved draft${draftResult?.message ? `: ${String(draftResult.message)}` : '.'}`,
  );
}

const finalAnswer = session.events
  .filter((event) => event.author !== 'user' && isFinalResponse(event))
  .map((event) => stringifyContent(event).trim())
  .filter(Boolean)
  .at(-1);
console.log('Final answer:', finalAnswer ?? 'none');
if (!finalAnswer) {
  problems.push('The session has no final text answer.');
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`FAIL ${problem}`);
  }
  process.exit(1);
}
console.log('session:check passed');
