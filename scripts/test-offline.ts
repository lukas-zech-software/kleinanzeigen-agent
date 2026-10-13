import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  parsePriceAnswer,
  priceEvaluatorAgent,
  priceEvaluatorOutputSchema,
} from '../src/agents/price-evaluator.js';
import {
  addPhotoToRequest,
  visionInspectorAgent,
  visionInspectorOutputSchema,
} from '../src/agents/vision-inspector.js';
import { PHOTO_PATH_KEY } from '../src/session-state.js';
import { runAgentOnce } from './support/run-agent-once.js';
import {
  recordedRequests,
  resetScriptedModel,
  scriptAnswers,
  useScriptedModel,
} from './support/scripted-llm.js';

// From here on both agents talk to a scripted model. No request leaves this machine.
useScriptedModel(visionInspectorAgent, priceEvaluatorAgent);

const visionAnswer = {
  title: 'Nintendo Game Boy Classic DMG-01',
  detectedCategory: 'Handheld Consoles',
  condition: 'used',
  keyAttributes: ['Nintendo', 'DMG-01', 'grey'],
};
const priceAnswer = { priceMin: 60, priceMax: 110, recommendedPrice: 85, currency: 'EUR' };
const question = 'Describe the item in the photo.';

const directory = await mkdtemp(path.join(tmpdir(), 'test-offline-'));
try {
  // Case 1: the vision agent sends the photo and asks for structured output.
  assert.equal(
    visionInspectorAgent.beforeModelCallback,
    addPhotoToRequest,
    'case 1: the vision agent uses addPhotoToRequest as its before-model callback',
  );
  const pngPath = path.join(directory, 'Old Camera.v2.PNG');
  await writeFile(pngPath, 'not a real image, the scripted model does not look at it');
  for (const [photoPath, mimeType] of [
    ['examples/photos/game-boy.jpg', 'image/jpeg'],
    [pngPath, 'image/png'],
  ]) {
    resetScriptedModel();
    scriptAnswers(JSON.stringify(visionAnswer));
    const run = await runAgentOnce(visionInspectorAgent, {
      message: question,
      state: { [PHOTO_PATH_KEY]: photoPath },
    });
    assert.equal(recordedRequests.length, 1, 'case 1: the vision agent calls the model once');
    const parts = recordedRequests[0].contents.flatMap((content) => content.parts ?? []);
    const image = parts.find((part) => part.inlineData);
    assert.ok(image?.inlineData, `case 1: the request for ${photoPath} carries an image part`);
    assert.equal(
      image.inlineData.mimeType,
      mimeType,
      'case 1: the image has the MIME type of the file',
    );
    assert.ok(image.inlineData.data, 'case 1: the image part carries the file content');
    assert.ok(
      parts.some((part) => part.text === question),
      'case 1: the user message is still in the request',
    );
    assert.ok(
      recordedRequests[0].config?.responseSchema,
      'case 1: the request asks for structured output (outputSchema is set on the agent)',
    );
    assert.deepEqual(
      visionInspectorOutputSchema.parse(JSON.parse(run.finalText)),
      visionAnswer,
      'case 1: the final text parses with the output schema and keeps every field',
    );
  }

  // Case 2: without a usable photo the run fails before the model is called.
  const unusable: [string, Record<string, unknown>, RegExp][] = [
    ['no photo_path', {}, /photo_path/],
    ['an empty photo_path', { [PHOTO_PATH_KEY]: '' }, /photo_path/],
    ['a photo_path that is not a string', { [PHOTO_PATH_KEY]: 42 }, /photo_path/],
    [
      'a file that does not exist',
      { [PHOTO_PATH_KEY]: path.join(directory, 'missing.jpg') },
      /not found/i,
    ],
    [
      'a file type that is not a photo',
      { [PHOTO_PATH_KEY]: 'package.json' },
      /unsupported photo type/i,
    ],
  ];
  for (const [label, state, message] of unusable) {
    resetScriptedModel();
    scriptAnswers(JSON.stringify(visionAnswer));
    await assert.rejects(
      runAgentOnce(visionInspectorAgent, { message: question, state }),
      message,
      `case 2: ${label} fails with a clear error`,
    );
    assert.equal(recordedRequests.length, 0, `case 2: with ${label} the model is not called`);
  }

  // Case 3: the price agent declares Google Search and nothing else.
  resetScriptedModel();
  scriptAnswers(`Found three listings.\n${JSON.stringify(priceAnswer)}`);
  const priceRun = await runAgentOnce(priceEvaluatorAgent, {
    message: 'What do used Game Boy Classic consoles currently sell for in Germany?',
  });
  assert.equal(recordedRequests.length, 1, 'case 3: the price agent calls the model once');
  const tools: Record<string, unknown>[] = (recordedRequests[0].config?.tools ?? []).map(
    (tool) => ({ ...tool }),
  );
  assert.ok(
    tools.some((tool) => 'googleSearch' in tool),
    'case 3: the price agent declares Google Search',
  );
  assert.ok(
    tools.every((tool) => !('functionDeclarations' in tool)),
    'case 3: the price agent declares no function beside Google Search',
  );
  assert.equal(
    recordedRequests[0].config?.responseSchema,
    undefined,
    'case 3: the price agent has no output schema, because the API rejects it beside search',
  );
  assert.deepEqual(parsePriceAnswer(priceRun.finalText), priceAnswer, 'case 3: the answer parses');

  // Case 4: no schema uses a field the Gemini API rejects.
  resetScriptedModel();
  scriptAnswers(JSON.stringify(visionAnswer), JSON.stringify(priceAnswer));
  await runAgentOnce(visionInspectorAgent, {
    message: question,
    state: { [PHOTO_PATH_KEY]: 'examples/photos/game-boy.jpg' },
  });
  await runAgentOnce(priceEvaluatorAgent, { message: 'What does a used Game Boy sell for?' });
  const sent = JSON.stringify(recordedRequests.map((request) => request.config));
  for (const field of ['exclusiveMinimum', 'exclusiveMaximum']) {
    assert.ok(
      !sent.includes(field),
      `case 4: a schema sends "${field}", which the Gemini API rejects. Use .min() or .max() instead of .positive(), .gt() or .lt()`,
    );
  }

  // Case 5: parsePriceAnswer accepts the forms a model answers in and rejects the rest.
  const json = JSON.stringify(priceAnswer);
  const accepted: [string, string][] = [
    ['plain JSON', json],
    ['JSON in a code fence', `\`\`\`json\n${json}\n\`\`\``],
    ['JSON after a sentence', `Listings range widely. Here is my estimate:\n\n${json}`],
    ['pretty-printed JSON', JSON.stringify(priceAnswer, null, 2)],
  ];
  for (const [label, text] of accepted) {
    assert.deepEqual(parsePriceAnswer(text), priceAnswer, `case 5: accepts ${label}`);
  }
  const rejected: [string, string][] = [
    ['an answer without JSON', 'Used Game Boys sell for 60 to 110 euros.'],
    ['an empty answer', ''],
    ['JSON that is cut off', '{"priceMin": 60, "priceMax": 110'],
    [
      'an object with a missing field',
      JSON.stringify({ priceMin: 60, priceMax: 110, currency: 'EUR' }),
    ],
    ['a price that is text', JSON.stringify({ ...priceAnswer, recommendedPrice: '85 EUR' })],
  ];
  for (const [label, text] of rejected) {
    assert.throws(() => parsePriceAnswer(text), `case 5: rejects ${label}`);
  }
  assert.equal(
    priceEvaluatorOutputSchema.safeParse(priceAnswer).success,
    true,
    'case 5: the price schema accepts a complete answer',
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log('test:offline passed: 5 cases');
