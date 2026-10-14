import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EvalStatus, State, getFunctionResponses, runEvals, type EvalEntry } from '@google/adk';
import { publisherAgent } from '../src/agents/publisher-agent.js';
import { DraftFormatError, parseDraft, readDraft } from '../src/draft/read-draft.js';
import { HANDOFF_CHECKLIST, packagePathFor } from '../src/listing/package-file.js';
import { MAX_TITLE_LENGTH, findProblems } from '../src/listing/rules.js';
import { DRAFT_PATH_KEY, LISTING_KEY } from '../src/session-state.js';
import { prepareListing } from '../src/tools/prepare-listing.js';
import { runAgentOnce } from './support/run-agent-once.js';
import {
  recordedRequests,
  resetScriptedModel,
  scriptAnswers,
  useScriptedModel,
} from './support/scripted-llm.js';

// From here on the publisher agent talks to a scripted model. No request leaves this machine.
useScriptedModel(publisherAgent);

const EVAL_SET_FILE = 'examples/evals/publisher.evalset.json';
const approvedText = readFileSync('examples/drafts/approved.md', 'utf8');
const question = 'Prepare the listing for posting.';

const directory = await mkdtemp(path.join(tmpdir(), 'test-offline-chapter-03-'));
/** Writes a draft into the temp directory, with the example photo beside it. */
async function draftInTempDirectory(name: string, content: string): Promise<string> {
  await copyFile('examples/photos/game-boy.jpg', path.join(directory, 'game-boy.jpg'));
  const draftPath = path.join(directory, name);
  await writeFile(
    draftPath,
    content.replace('image: ../photos/game-boy.jpg', 'image: game-boy.jpg'),
  );
  return draftPath;
}

try {
  // Case 10: parseDraft reads what a person edited and says what is wrong when it cannot.
  const parsed = parseDraft(approvedText);
  assert.deepEqual(
    parsed,
    {
      title: 'Nintendo Game Boy Classic DMG-01, grau',
      price: 85,
      currency: 'EUR',
      category: 'Handheld Consoles',
      condition: 'used',
      image: '../photos/game-boy.jpg',
      status: 'freigegeben',
      description:
        'Verkaufe meinen originalen Nintendo Game Boy Classic in Grau. Das Gerät ist gebraucht und hat leichte Kratzer am Gehäuse. Alle Tasten funktionieren.',
    },
    'case 10: parseDraft returns every frontmatter field and the text as description',
  );
  let fromWindows;
  try {
    fromWindows = parseDraft(approvedText.replace(/\n/g, '\r\n'));
  } catch (error) {
    assert.fail(
      `case 10: parseDraft must accept Windows line endings, but it threw: ${String(error)}`,
    );
  }
  assert.deepEqual(fromWindows, parsed, 'case 10: Windows line endings give the same draft');
  const unreadable: [string, string, RegExp][] = [
    ['a file without frontmatter', 'Just a text.\n', /frontmatter/i],
    ['a frontmatter block that is not closed', '---\ntitle: Game Boy\n\nText\n', /closed|---/i],
    ['frontmatter that is not YAML', '---\ntitle: "unclosed\n---\n\nText\n', /yaml/i],
    ['a price that is text', approvedText.replace('price: 85', 'price: cheap'), /price/],
    ['a status nobody defined', approvedText.replace('freigegeben', 'fertig'), /status/],
    [
      'a draft without text',
      approvedText.slice(0, approvedText.indexOf('\n---\n', 4) + 5),
      /description/,
    ],
  ];
  for (const [label, content, message] of unreadable) {
    assert.throws(
      () => parseDraft(content),
      (error) => error instanceof DraftFormatError && message.test(error.message),
      `case 10: ${label} throws a DraftFormatError that names the problem`,
    );
  }
  await assert.rejects(
    readDraft(path.join(directory, 'missing.md')),
    DraftFormatError,
    'case 10: a draft file that does not exist is a DraftFormatError',
  );

  // Case 11: findProblems names every broken rule with its field.
  const fields = async (draft: typeof parsed, folder = 'examples/drafts') =>
    (await findProblems(draft, folder)).map((problem) => problem.field);
  assert.deepEqual(await fields(parsed), [], 'case 11: an approved, valid draft has no problem');
  assert.deepEqual(
    await fields({ ...parsed, title: 'x'.repeat(MAX_TITLE_LENGTH) }),
    [],
    `case 11: a title of exactly ${MAX_TITLE_LENGTH} characters is allowed`,
  );
  const tooLong = await findProblems(
    { ...parsed, title: 'x'.repeat(MAX_TITLE_LENGTH + 1) },
    'examples/drafts',
  );
  assert.deepEqual(
    tooLong.map((problem) => problem.field),
    ['title'],
    'case 11: a title that is one character too long is a problem of the field "title"',
  );
  assert.match(tooLong[0].message, /66/, 'case 11: the message says how long the title is');
  assert.match(tooLong[0].message, /65/, 'case 11: the message says what the limit is');
  assert.deepEqual(
    await fields({ ...parsed, image: 'missing.jpg' }),
    ['image'],
    'case 11: an image that does not exist is a problem of the field "image"',
  );
  assert.deepEqual(
    await fields({ ...parsed, image: '.' }),
    ['image'],
    'case 11: a folder is not an image',
  );
  assert.deepEqual(
    await fields({ ...parsed, status: 'draft' }),
    ['status'],
    'case 11: a draft that is not approved is a problem of the field "status"',
  );
  assert.deepEqual(
    await fields({ ...parsed, status: 'draft', title: 'x'.repeat(80), image: 'missing.jpg' }),
    ['status', 'title', 'image'],
    'case 11: every broken rule is reported, not only the first',
  );

  // Case 12: prepare_listing writes the package for a valid draft and nothing otherwise.
  const draftPath = await draftInTempDirectory('game-boy.md', approvedText);
  const expectedPackagePath = path.join(directory, 'game-boy.listing.json');
  const prepared = await prepareListing({}, { state: new State({ [DRAFT_PATH_KEY]: draftPath }) });
  assert.deepEqual(
    prepared,
    { status: 'success', packagePath: expectedPackagePath },
    'case 12: a valid, approved draft gives a success result with the package path beside the draft',
  );
  assert.deepEqual(
    JSON.parse(await readFile(expectedPackagePath, 'utf8')),
    {
      title: parsed.title,
      price: parsed.price,
      currency: parsed.currency,
      category: parsed.category,
      condition: parsed.condition,
      description: parsed.description,
      images: ['game-boy.jpg'],
      checklist: HANDOFF_CHECKLIST,
    },
    'case 12: the package holds the fields of the draft, its image, and the checklist',
  );
  await rm(expectedPackagePath);

  const rejected: [string, string | undefined, string][] = [
    ['a draft that is not approved', approvedText.replace('freigegeben', 'draft'), 'status'],
    [
      'a title that is too long',
      approvedText.replace(/^title: .*$/m, `title: ${'x'.repeat(80)}`),
      'title',
    ],
    ['a draft that cannot be read', 'Just a text.\n', 'draft'],
    ['a draft file that does not exist', undefined, 'draft'],
  ];
  for (const [label, content, field] of rejected) {
    const rejectedPath =
      content === undefined
        ? path.join(directory, 'missing.md')
        : await draftInTempDirectory('rejected.md', content);
    const result = await prepareListing(
      {},
      { state: new State({ [DRAFT_PATH_KEY]: rejectedPath }) },
    );
    if (result.status !== 'error') {
      assert.fail(`case 12: ${label} must give an error result`);
    }
    assert.ok(
      result.problems.some((problem) => problem.field === field),
      `case 12: ${label} is reported as a problem of the field "${field}"`,
    );
  }
  for (const [label, state] of [
    ['no tool context', undefined],
    ['no draft_path', new State()],
    ['a draft_path that is not a string', new State({ [DRAFT_PATH_KEY]: 42 })],
  ] as const) {
    const result = await prepareListing({}, state && { state });
    assert.equal(result.status, 'error', `case 12: ${label} gives an error result`);
  }
  assert.ok(
    (await readdir(directory)).every((file) => !file.endsWith('.listing.json')),
    'case 12: no package is written for a draft that was rejected',
  );

  // Case 13: without an approval the agent answers itself, and the model is never called.
  for (const [label, state, expected] of [
    [
      'a draft that is not approved',
      { [DRAFT_PATH_KEY]: 'examples/drafts/not-approved.md' },
      /not approved/i,
    ],
    [
      'a draft that cannot be read',
      { [DRAFT_PATH_KEY]: path.join(directory, 'missing.md') },
      /nothing was prepared/i,
    ],
    ['no draft path', {}, /draft_path/],
  ] as const) {
    resetScriptedModel();
    scriptAnswers({ call: 'prepare_listing', args: {} }, 'The package is ready.');
    const run = await runAgentOnce(publisherAgent, { message: question, state });
    assert.equal(recordedRequests.length, 0, `case 13: with ${label} the model is not called`);
    assert.match(run.finalText, expected, `case 13: with ${label} the answer says what is wrong`);
    assert.equal(
      run.events.flatMap((event) => getFunctionResponses(event)).length,
      0,
      `case 13: with ${label} no tool runs`,
    );
  }

  // Case 14: with an approval the agent sees the listing and has exactly one tool, without arguments.
  resetScriptedModel();
  scriptAnswers({ call: 'prepare_listing', args: {} }, 'The package is ready.');
  const approvedRun = await runAgentOnce(publisherAgent, {
    message: question,
    state: { [DRAFT_PATH_KEY]: draftPath },
  });
  assert.equal(
    recordedRequests.length,
    2,
    'case 14: the model is called, and again after the tool result',
  );
  assert.deepEqual(
    approvedRun.session.state[LISTING_KEY],
    { ...parsed, image: 'game-boy.jpg' },
    'case 14: the callback stores the approved listing in the session state',
  );
  assert.ok(
    JSON.stringify(recordedRequests[0].config?.systemInstruction).includes(parsed.title),
    'case 14: the instruction carries the listing, through the {listing} placeholder',
  );
  const declarations = (recordedRequests[0].config?.tools ?? []).flatMap((tool) =>
    'functionDeclarations' in tool ? (tool.functionDeclarations ?? []) : [],
  );
  assert.deepEqual(
    declarations.map((declaration) => declaration.name),
    ['prepare_listing'],
    'case 14: the agent has exactly one tool, prepare_listing',
  );
  assert.deepEqual(
    declarations[0].parameters?.properties ?? {},
    {},
    'case 14: prepare_listing takes no arguments, so the model cannot pass a path or a field',
  );
  assert.ok(
    existsSync(expectedPackagePath),
    'case 14: the run writes the package beside the draft',
  );
  const sent = JSON.stringify(recordedRequests.map((request) => request.config));
  for (const field of ['exclusiveMinimum', 'exclusiveMaximum']) {
    assert.ok(
      !sent.includes(field),
      `case 14: a schema sends "${field}", which the Gemini API rejects`,
    );
  }

  // Case 15: the eval set covers the three kinds of draft, and it passes with ADK's eval runner.
  const evalCases: EvalEntry[] = JSON.parse(readFileSync(EVAL_SET_FILE, 'utf8'));
  const kinds = new Set<string>();
  const packages: string[] = [];
  resetScriptedModel();
  for (const entry of evalCases) {
    const evalDraftPath = entry.initial_session?.state?.[DRAFT_PATH_KEY];
    assert.equal(
      typeof evalDraftPath,
      'string',
      `case 15: the eval case "${entry.name}" gives a draft path in initial_session.state`,
    );
    const draft = await readDraft(String(evalDraftPath));
    const expectedCalls = entry.data[0]?.expected_tool_use;
    if (draft.status !== 'freigegeben') {
      kinds.add('not approved');
      assert.deepEqual(
        expectedCalls,
        [],
        `case 15: "${entry.name}" uses a draft that is not approved, so it expects no tool call`,
      );
    } else {
      const problems = await findProblems(draft, path.dirname(String(evalDraftPath)));
      kinds.add(problems.length > 0 ? 'approved with a problem' : 'approved and valid');
      assert.deepEqual(
        expectedCalls,
        [{ tool_name: 'prepare_listing', tool_input: {} }],
        `case 15: "${entry.name}" uses an approved draft, so it expects one call of prepare_listing without arguments`,
      );
      scriptAnswers({ call: 'prepare_listing', args: {} }, 'Done.');
      packages.push(packagePathFor(String(evalDraftPath)));
    }
  }
  assert.deepEqual(
    [...kinds].sort(),
    ['approved and valid', 'approved with a problem', 'not approved'],
    'case 15: the eval set has a draft that is not approved, an approved valid one, and an approved one with a problem',
  );
  try {
    for await (const result of runEvals({
      evalCasesByEvalSetId: { [EVAL_SET_FILE]: evalCases },
      rootAgent: publisherAgent,
      evalMetrics: [{ metric_name: 'tool_trajectory_avg_score', threshold: 1 }],
    })) {
      assert.equal(
        result.final_eval_status,
        EvalStatus.PASSED,
        `case 15: the eval case "${result.eval_id}" passes with ADK's eval runner`,
      );
    }
  } finally {
    await Promise.all(packages.map((file) => rm(file, { force: true })));
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('test:offline passed: 6 cases of chapter 3');
