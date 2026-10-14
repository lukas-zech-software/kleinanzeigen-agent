import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { DRAFT_PATH_KEY, PHOTO_PATH_KEY } from '../src/session-state.js';
import {
  runWorkflow,
  WorkflowError,
  type HttpCall,
  type HttpResponse,
} from './support/workflow-interpreter.js';

// No request leaves this machine. The API server runs here without an API key, and the only
// agent run that reaches it is stopped by the publisher's approval gate before any model call.

const WORKFLOW_FILE = 'cloud/workflow.yaml';
const MOUNT_PATH = '/mnt/listings';
const workflow = readFileSync(WORKFLOW_FILE, 'utf8');
const dockerfile = readFileSync('Dockerfile', 'utf8');

/** The event Eventarc hands to the workflow when a file lands in the bucket. */
function storageEvent(name: string): unknown {
  return {
    type: 'google.cloud.storage.object.v1.finalized',
    data: { bucket: 'test-bucket', name, contentType: 'application/octet-stream' },
  };
}

/** Runs the workflow for one file against a recording fake of the API server. */
async function routeFile(
  name: string,
  runEvents: unknown[] = [
    { author: 'agent', content: { role: 'model', parts: [{ text: 'Done.' }] } },
  ],
): Promise<{ calls: HttpCall[]; result: unknown }> {
  const calls: HttpCall[] = [];
  const result = await runWorkflow(workflow, storageEvent(name), {
    env: {
      SERVICE_URL: 'https://agents.example',
      MOUNT_PATH,
      GOOGLE_CLOUD_WORKFLOW_EXECUTION_ID: 'execution-1',
    },
    http: async (call): Promise<HttpResponse> => {
      calls.push(call);
      if (call.url.endsWith('/run')) {
        return { code: 200, body: runEvents };
      }
      return { code: 200, body: { id: 'execution-1', state: {} } };
    },
  });
  return { calls, result };
}

/** Reads the CMD of the Dockerfile as the command line it starts. */
function dockerCommand(): string[] {
  const joined = dockerfile.replace(/\\\r?\n/g, ' ');
  const lines = joined.split(/\r?\n/).filter((line) => /^\s*CMD\s/i.test(line));
  assert.ok(lines.length > 0, 'case 16: the Dockerfile has a CMD that starts the API server');
  const command = lines
    .at(-1)!
    .replace(/^\s*CMD\s+/i, '')
    .trim();
  if (command.startsWith('[')) {
    const parsed = JSON.parse(command) as unknown;
    assert.ok(
      Array.isArray(parsed) && parsed.every((part) => typeof part === 'string'),
      'case 16: CMD in the JSON form is a list of strings',
    );
    return parsed;
  }
  return ['sh', '-c', command];
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

const port = await freePort();
const serverEnv: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
delete serverEnv.GEMINI_API_KEY;
delete serverEnv.GOOGLE_API_KEY;
delete serverEnv.GOOGLE_GENAI_API_KEY;
const command = dockerCommand();
const server = spawn(command[0]!, command.slice(1), {
  env: serverEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
let serverOutput = '';
server.stdout.on('data', (chunk: Buffer) => (serverOutput += chunk.toString()));
server.stderr.on('data', (chunk: Buffer) => (serverOutput += chunk.toString()));
const stopServer = (): void => {
  if (server.pid !== undefined && server.exitCode === null) {
    try {
      process.kill(-server.pid, 'SIGTERM'); // The whole group: sh, npx, and the server.
    } catch {
      // Already gone.
    }
  }
};

try {
  // Case 16: the container image starts ADK's API server with every agent in adk/.
  assert.match(
    dockerfile,
    /^\s*ENV\s+GOOGLE_GENAI_USE_ENTERPRISE[= ]false\s*$/m,
    'case 16: the Dockerfile keeps GOOGLE_GENAI_USE_ENTERPRISE=false, so the agents use the Gemini API key',
  );
  assert.doesNotMatch(
    dockerfile,
    /^\s*(ENV|ARG)\s+GEMINI_API_KEY|^\s*COPY[^\n]*\.env\b/m,
    'case 16: the key never goes into the image; Cloud Run passes it from Secret Manager',
  );
  const commandLine = command.join(' ');
  assert.match(commandLine, /\badk\s+api_server\b/, 'case 16: CMD runs `adk api_server`');
  assert.match(
    commandLine,
    /--host[= ]0\.0\.0\.0/,
    'case 16: the server listens on 0.0.0.0, or Cloud Run cannot reach it',
  );
  let apps: unknown;
  for (let attempt = 0; attempt < 120 && server.exitCode === null; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/list-apps`);
      apps = await response.json();
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  assert.ok(
    apps !== undefined,
    `case 16: the CMD starts a server on the port in $PORT (${port}). Its output:\n${serverOutput}`,
  );
  assert.deepEqual(
    [...(apps as string[])].sort(),
    ['listing_agent', 'price_evaluator', 'publisher_agent', 'vision_inspector'],
    'case 16: the server serves every agent in adk/',
  );

  // Case 17: the workflow picks the agent and the state by the type of the file.
  for (const name of [
    'photos/camera.jpg',
    'photos/CAMERA.JPG',
    'photos/camera.jpeg',
    'photos/camera.png',
  ]) {
    const { calls } = await routeFile(name);
    assert.equal(calls.length, 2, `case 17: ${name} creates a session and runs an agent`);
    const [session, run] = calls as [HttpCall, HttpCall];
    assert.match(
      session.url,
      /^https:\/\/agents\.example\/apps\/listing_agent\/users\/[^/]+\/sessions\/[^/]+$/,
      `case 17: ${name} creates a session of listing_agent`,
    );
    assert.deepEqual(
      (session.body as { state?: unknown } | undefined)?.state,
      { [PHOTO_PATH_KEY]: `${MOUNT_PATH}/${name}` },
      `case 17: the session state of ${name} holds the photo path under "${PHOTO_PATH_KEY}"`,
    );
    const body = run.body as Record<string, unknown> | undefined;
    assert.equal(body?.appName, 'listing_agent', `case 17: ${name} runs listing_agent`);
    assert.ok(
      typeof (body?.newMessage as { parts?: { text?: unknown }[] } | undefined)?.parts?.[0]
        ?.text === 'string',
      `case 17: the run of ${name} sends a text message`,
    );
  }
  {
    const name = 'photos/game-boy.md';
    const { calls } = await routeFile(name);
    assert.equal(calls.length, 2, `case 17: ${name} creates a session and runs an agent`);
    assert.match(
      calls[0]!.url,
      /\/apps\/publisher_agent\/users\/[^/]+\/sessions\/[^/]+$/,
      `case 17: ${name} creates a session of publisher_agent`,
    );
    assert.deepEqual(
      (calls[0]!.body as { state?: unknown } | undefined)?.state,
      { [DRAFT_PATH_KEY]: `${MOUNT_PATH}/${name}` },
      `case 17: the session state of ${name} holds the draft path under "${DRAFT_PATH_KEY}"`,
    );
    assert.equal(
      (calls[1]!.body as { appName?: unknown } | undefined)?.appName,
      'publisher_agent',
      `case 17: ${name} runs publisher_agent`,
    );
  }
  for (const name of [
    'photos/game-boy.listing.json',
    'photos/notes.txt',
    'photos/game-boy.md.bak',
    'photos/',
  ]) {
    const { calls } = await routeFile(name);
    assert.equal(calls.length, 0, `case 17: ${name} starts no agent`);
  }
  {
    const { result } = await routeFile('photos/camera.jpg');
    assert.equal(
      (result as { answer?: unknown } | null)?.answer,
      'Done.',
      "case 17: the workflow returns the agent's answer",
    );
    await assert.rejects(
      routeFile('photos/camera.jpg', [{ errorCode: 'MODEL_ERROR', errorMessage: 'quota' }]),
      WorkflowError,
      'case 17: a run that ends in an error event makes the workflow fail',
    );
  }

  // Case 18: the two calls of the workflow work against the real API server.
  const examples = path.resolve('examples');
  const execution = randomUUID();
  const authTypes: unknown[] = [];
  const result = await runWorkflow(workflow, storageEvent('drafts/not-approved.md'), {
    env: {
      SERVICE_URL: `http://127.0.0.1:${port}`,
      MOUNT_PATH: examples,
      GOOGLE_CLOUD_WORKFLOW_EXECUTION_ID: execution,
    },
    http: async (call): Promise<HttpResponse> => {
      authTypes.push((call.auth as { type?: unknown } | undefined)?.type);
      const response = await fetch(call.url, {
        method: call.method,
        headers: { 'Content-Type': 'application/json' },
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
      });
      const text = await response.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        // Not JSON; keep the text.
      }
      return { code: response.status, body };
    },
  });
  assert.deepEqual(
    authTypes,
    ['OIDC', 'OIDC'],
    'case 18: both calls authenticate with an OIDC token, or Cloud Run answers 403',
  );
  assert.match(
    String((result as { answer?: unknown } | null)?.answer),
    /not approved/i,
    'case 18: the API server ran publisher_agent, and its gate answered for the unapproved draft',
  );
} catch (error) {
  if (error instanceof WorkflowError || (error as Error).name === 'UnsupportedError') {
    console.error(`${WORKFLOW_FILE}: ${(error as Error).message}`);
  }
  throw error;
} finally {
  stopServer();
}

console.log('test:offline passed: 3 cases of chapter 4');
