import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { State, getFunctionResponses } from '@google/adk';
import { parse } from 'yaml';
import { listingAgent } from '../src/agents/listing-agent.js';
import { priceEvaluatorAgent } from '../src/agents/price-evaluator.js';
import { visionInspectorAgent } from '../src/agents/vision-inspector.js';
import { listingDraftSchema } from '../src/draft/draft-file.js';
import { PHOTO_PATH_KEY, SEARCH_QUERIES_KEY } from '../src/session-state.js';
import { toolCallsOf } from '../src/session/tool-calls.js';
import {
  createListingDraft,
  createListingDraftInputSchema,
} from '../src/tools/create-listing-draft.js';
import { runAgentOnce } from './support/run-agent-once.js';
import {
  recordedRequests,
  resetScriptedModel,
  scriptAnswers,
  useScriptedModel,
} from './support/scripted-llm.js';

// From here on all three agents talk to a scripted model. No request leaves this machine.
useScriptedModel(listingAgent, visionInspectorAgent, priceEvaluatorAgent);

function splitDraft(content: string): { frontmatter: unknown; body: string } {
  assert.ok(content.startsWith('---\n'), 'the draft starts with a frontmatter block');
  const end = content.indexOf('\n---\n', 4);
  assert.notEqual(end, -1, 'the frontmatter block is closed with a --- line');
  return { frontmatter: parse(content.slice(4, end + 1)), body: content.slice(end + 5) };
}

const directory = await mkdtemp(path.join(tmpdir(), 'test-offline-chapter-02-'));
try {
  // Case 6: the draft tool writes every supplied field beside the photo and never overwrites.
  // Values no tool would hard-code, with characters that are special in YAML.
  const rawInput = {
    title: 'Kaputter "Game Boy": Ersatzteile, #3',
    price: 12.75,
    currency: 'CHF',
    category: 'Handheld-Konsolen & Zubehör',
    condition: 'defective',
    description:
      'Zeile eins: mit Doppelpunkt.\n\n---\n\n- Zeile drei beginnt mit einem Strich\n# und Zeile vier mit einer Raute',
  };
  const toolDirectory = path.join(directory, 'tool');
  await mkdir(toolDirectory);
  const photoName = 'Game Boy.v2.JPG';
  const photoPath = path.join(toolDirectory, photoName);
  // Built here and not through draftPathFor, so the test does not trust the code it tests.
  const expectedDraftPath = path.join(toolDirectory, 'Game Boy.v2.md');
  await writeFile(photoPath, '');

  const input = createListingDraftInputSchema.parse(rawInput);
  const toolContext = { state: new State({ [PHOTO_PATH_KEY]: photoPath }) };

  const first = await createListingDraft(input, toolContext);
  if (first.status !== 'success') {
    assert.fail(`case 6: expected a success result, got the error "${first.message}"`);
  }
  assert.equal(first.draftPath, expectedDraftPath, 'case 6: the draft path is beside the photo');
  const written = await readFile(expectedDraftPath, 'utf8');
  const draft = splitDraft(written);
  assert.deepEqual(
    draft.frontmatter,
    {
      title: rawInput.title,
      price: rawInput.price,
      currency: rawInput.currency,
      category: rawInput.category,
      condition: rawInput.condition,
      image: photoName,
      status: 'draft',
    },
    'case 6: the frontmatter has exactly the seven fields, with the supplied values',
  );
  assert.equal(draft.body.trim(), rawInput.description, 'case 6: the body is the description');

  const second = await createListingDraft(input, toolContext);
  assert.equal(second.status, 'error', 'case 6: a second call returns an error result');
  assert.equal(
    await readFile(expectedDraftPath, 'utf8'),
    written,
    'case 6: the existing draft is unchanged',
  );

  const workingDirectoryBefore = (await readdir(process.cwd())).sort();
  const unusable: [string, State | undefined][] = [
    ['no tool context', undefined],
    ['no photo_path', new State()],
    ['an empty photo_path', new State({ [PHOTO_PATH_KEY]: '' })],
    ['a photo_path that is not a string', new State({ [PHOTO_PATH_KEY]: 42 })],
    [
      'a photo that does not exist',
      new State({ [PHOTO_PATH_KEY]: path.join(toolDirectory, 'missing.jpg') }),
    ],
  ];
  for (const [label, state] of unusable) {
    const result = await createListingDraft(input, state && { state });
    assert.equal(result.status, 'error', `case 6: ${label} returns an error result`);
  }
  assert.deepEqual(
    (await readdir(toolDirectory)).sort(),
    [photoName, 'Game Boy.v2.md'],
    'case 6: nothing else was written beside the photo',
  );
  assert.deepEqual(
    (await readdir(process.cwd())).sort(),
    workingDirectoryBefore,
    'case 6: nothing was written to the working directory',
  );

  const fullDraft = { ...rawInput, image: photoName, status: 'draft' };
  for (const price of [0, -5]) {
    assert.equal(
      createListingDraftInputSchema.safeParse({ ...rawInput, price }).success,
      false,
      `case 6: the tool input rejects the price ${price}`,
    );
    assert.equal(
      listingDraftSchema.safeParse({ ...fullDraft, price }).success,
      false,
      `case 6: the draft schema rejects the price ${price}`,
    );
  }
  assert.equal(
    createListingDraftInputSchema.safeParse({ ...rawInput, price: 0.01 }).success,
    true,
    'case 6: the tool input accepts the price 0.01',
  );

  // Case 7: the listing agent is wired to both agents and the draft tool.
  const vision = {
    title: 'Nintendo Game Boy DMG-01',
    detectedCategory: 'Handheld Consoles',
    condition: 'used',
    keyAttributes: ['Nintendo', 'DMG-01', 'grey'],
  };
  const priceQuestion =
    'What do second-hand listings for a used Nintendo Game Boy DMG-01 currently sell for in Germany?';
  const searchQueries = ['nintendo game boy dmg-01 gebraucht preis'];
  const draftArguments = {
    title: 'Nintendo Game Boy DMG-01, grau',
    price: 85,
    currency: 'EUR',
    category: 'Handheld Consoles',
    condition: 'used',
    description: 'Verkaufe meinen originalen Game Boy.',
  };
  const agentPhoto = path.join(directory, 'game-boy.jpg');
  await copyFile('examples/photos/game-boy.jpg', agentPhoto);

  resetScriptedModel();
  scriptAnswers(
    { call: 'vision_inspector', args: { request: 'Describe the item in the photo.' } },
    JSON.stringify(vision),
    { call: 'price_evaluator', args: { request: priceQuestion } },
    {
      text: 'Found listings.\n{"priceMin": 60, "priceMax": 110, "recommendedPrice": 85, "currency": "EUR"}',
      searchQueries,
    },
    { call: 'create_listing_draft', args: draftArguments },
    'The draft is saved.',
  );
  const run = await runAgentOnce(listingAgent, {
    message: 'Create the listing draft for the photo.',
    state: { [PHOTO_PATH_KEY]: agentPhoto },
  });

  const declared = (recordedRequests[0].config?.tools ?? [])
    .flatMap((tool) => ('functionDeclarations' in tool ? (tool.functionDeclarations ?? []) : []))
    .map((declaration) => declaration.name)
    .sort();
  assert.deepEqual(
    declared,
    ['create_listing_draft', 'price_evaluator', 'vision_inspector'],
    'case 7: the listing agent declares exactly the two agents and the draft tool',
  );
  const visionRequest = recordedRequests[1];
  assert.ok(
    visionRequest.contents.some((content) => (content.parts ?? []).some((part) => part.inlineData)),
    'case 7: the vision agent behind AgentTool receives the photo from the session state',
  );
  const agentDraft = splitDraft(await readFile(path.join(directory, 'game-boy.md'), 'utf8'));
  assert.deepEqual(
    agentDraft.frontmatter,
    {
      title: draftArguments.title,
      price: draftArguments.price,
      currency: draftArguments.currency,
      category: draftArguments.category,
      condition: draftArguments.condition,
      image: 'game-boy.jpg',
      status: 'draft',
    },
    'case 7: the draft holds what the agent passed to the tool',
  );
  assert.deepEqual(
    run.session.state[SEARCH_QUERIES_KEY],
    searchQueries,
    'case 7: the search queries of the price agent are in the session state',
  );
  const sent = JSON.stringify(recordedRequests.map((request) => request.config));
  for (const field of ['exclusiveMinimum', 'exclusiveMaximum']) {
    assert.ok(
      !sent.includes(field),
      `case 7: a schema sends "${field}", which the Gemini API rejects. Use .min() or .max() instead of .positive(), .gt() or .lt()`,
    );
  }

  // Case 8: an agent behind AgentTool that fails returns an empty result, not an error.
  resetScriptedModel();
  scriptAnswers(
    { call: 'vision_inspector', args: { request: 'Describe the item in the photo.' } },
    'The photo could not be inspected.',
  );
  const missingPhoto = path.join(directory, 'missing.jpg');
  const failed = await runAgentOnce(listingAgent, {
    message: 'Create the listing draft for the photo.',
    state: { [PHOTO_PATH_KEY]: missingPhoto },
  });
  const visionResult = failed.events
    .flatMap((event) => getFunctionResponses(event))
    .find((response) => response.name === 'vision_inspector');
  assert.deepEqual(
    visionResult?.response,
    { result: '' },
    'case 8: the listing agent receives an empty result when the vision agent fails',
  );
  assert.ok(
    !(await readdir(directory)).includes('missing.md'),
    'case 8: no draft is written for a photo that could not be inspected',
  );

  // Case 9: toolCallsOf reads the tool calls of a session, in order.
  assert.deepEqual(
    toolCallsOf(run.session),
    [
      { tool_name: 'vision_inspector', tool_input: { request: 'Describe the item in the photo.' } },
      { tool_name: 'price_evaluator', tool_input: { request: priceQuestion } },
      { tool_name: 'create_listing_draft', tool_input: draftArguments },
    ],
    'case 9: toolCallsOf returns every tool call with its name and its arguments, in order',
  );
  assert.deepEqual(
    toolCallsOf({ events: [] }),
    [],
    'case 9: toolCallsOf returns an empty list for a session without events',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('test:offline passed: 4 cases of chapter 2');
