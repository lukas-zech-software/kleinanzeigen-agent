/**
 * Runs a Google Cloud Workflows file on this machine, for the offline test of chapter 4.
 *
 * Google offers no local emulator for Workflows, so this file implements the part of the
 * language that a workflow like `cloud/workflow.yaml` uses: the steps `assign`, `switch`, `call`
 * (`http.get`, `http.post`, `sys.log`), `for`, `steps`, `return`, `raise`, and `next`, and
 * expressions with variables, `.` and `[]`, the operators, and a few standard library functions.
 * Anything else fails with a message that names it. `gcloud workflows deploy` stays the final
 * check of the syntax, and a run in the cloud the final check of the behavior.
 *
 * Syntax reference: https://cloud.google.com/workflows/docs/reference/syntax
 */
import { parse } from 'yaml';

/** An HTTP request the workflow makes, as `http.get` or `http.post` describes it. */
export interface HttpCall {
  method: 'GET' | 'POST';
  url: string;
  auth?: unknown;
  body?: unknown;
  headers?: unknown;
  timeout?: unknown;
}

/** What the HTTP function of a run answers. A code outside 200 to 299 raises an HttpError. */
export interface HttpResponse {
  code: number;
  body: unknown;
}

export interface WorkflowOptions {
  /** What `sys.get_env` returns, such as `SERVICE_URL`. */
  env: Record<string, string>;
  /** Carries out the workflow's HTTP calls. */
  http: (call: HttpCall) => Promise<HttpResponse>;
}

/** An error the workflow raised, or one that Workflows itself would raise, such as a KeyError. */
export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

/** The workflow file uses something this interpreter does not implement. */
export class UnsupportedError extends Error {
  constructor(message: string) {
    super(`${message} (not supported by the offline workflow interpreter)`);
    this.name = 'UnsupportedError';
  }
}

type Scope = Map<string, unknown>;
type Outcome =
  { kind: 'done' } | { kind: 'return'; value: unknown } | { kind: 'next'; target: string };

const MAX_STEPS = 10_000;

/** Runs the `main` workflow of a Workflows YAML file with one argument and returns its result. */
export async function runWorkflow(
  source: string,
  argument: unknown,
  options: WorkflowOptions,
): Promise<unknown> {
  const document = parse(source) as unknown;
  if (!isMap(document) || !isMap(document.main)) {
    throw new UnsupportedError('a workflow file without a "main" workflow');
  }
  const main = document.main;
  const params = main.params ?? [];
  if (!Array.isArray(params) || params.length > 1) {
    throw new UnsupportedError('"main" with more than one parameter');
  }
  const scope: Scope = new Map();
  if (params.length === 1) {
    scope.set(String(params[0]), argument);
  }
  const interpreter = new Interpreter(options);
  const outcome = await interpreter.runSteps(main.steps, scope);
  if (outcome.kind === 'next' && outcome.target !== 'end') {
    throw new WorkflowError(`next: no step named "${outcome.target}"`, { tags: ['KeyError'] });
  }
  return outcome.kind === 'return' ? outcome.value : null;
}

class Interpreter {
  private stepsRun = 0;

  constructor(private readonly options: WorkflowOptions) {}

  async runSteps(steps: unknown, scope: Scope): Promise<Outcome> {
    if (!Array.isArray(steps)) {
      throw new UnsupportedError('"steps" that is not a list');
    }
    const named = steps.map((step, index) => {
      if (!isMap(step) || Object.keys(step).length !== 1) {
        throw new UnsupportedError(`step ${index + 1}: a step must be a map with one name`);
      }
      const [name, body] = Object.entries(step)[0]!;
      return { name, body };
    });
    let index = 0;
    while (index < named.length) {
      const { name, body } = named[index]!;
      if (++this.stepsRun > MAX_STEPS) {
        throw new WorkflowError(`more than ${MAX_STEPS} steps; is there a loop?`, null);
      }
      const outcome = await this.runStep(name, body, scope);
      if (outcome.kind === 'return') {
        return outcome;
      }
      if (outcome.kind === 'next') {
        if (outcome.target === 'end') {
          return outcome;
        }
        const target = named.findIndex((step) => step.name === outcome.target);
        if (target === -1) {
          return outcome; // The step is in an enclosing list of steps.
        }
        index = target;
        continue;
      }
      index++;
    }
    return { kind: 'done' };
  }

  private async runStep(name: string, body: unknown, scope: Scope): Promise<Outcome> {
    if (!isMap(body)) {
      throw new UnsupportedError(`step "${name}": a step body must be a map`);
    }
    const known = ['assign', 'switch', 'call', 'args', 'result', 'for', 'steps', 'return', 'raise'];
    for (const key of Object.keys(body)) {
      if (![...known, 'next'].includes(key)) {
        throw new UnsupportedError(`step "${name}": "${key}"`);
      }
    }
    if ('assign' in body) {
      this.assign(body.assign, scope, name);
    }
    if ('call' in body) {
      const value = await this.call(String(body.call), body.args, scope, name);
      if (typeof body.result === 'string') {
        scope.set(body.result, value);
      }
    }
    if ('switch' in body) {
      const outcome = await this.runSwitch(name, body.switch, scope);
      if (outcome.kind !== 'done') {
        return outcome;
      }
    }
    if ('for' in body) {
      const outcome = await this.runFor(name, body.for, scope);
      if (outcome.kind !== 'done') {
        return outcome;
      }
    }
    if ('steps' in body) {
      const outcome = await this.runSteps(body.steps, scope);
      if (outcome.kind !== 'done') {
        return outcome;
      }
    }
    if ('return' in body) {
      return { kind: 'return', value: this.value(body.return, scope) };
    }
    if ('raise' in body) {
      const payload = this.value(body.raise, scope);
      throw new WorkflowError(`step "${name}" raised ${JSON.stringify(payload)}`, payload);
    }
    if ('next' in body) {
      return { kind: 'next', target: String(body.next) };
    }
    return { kind: 'done' };
  }

  private assign(assignments: unknown, scope: Scope, step: string): void {
    if (!Array.isArray(assignments)) {
      throw new UnsupportedError(`step "${step}": "assign" that is not a list`);
    }
    for (const assignment of assignments) {
      if (!isMap(assignment) || Object.keys(assignment).length !== 1) {
        throw new UnsupportedError(`step "${step}": each assignment must be a map with one name`);
      }
      const [name, value] = Object.entries(assignment)[0]!;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new UnsupportedError(`step "${step}": the assignment to "${name}"`);
      }
      scope.set(name, this.value(value, scope));
    }
  }

  private async runSwitch(step: string, cases: unknown, scope: Scope): Promise<Outcome> {
    if (!Array.isArray(cases)) {
      throw new UnsupportedError(`step "${step}": "switch" that is not a list`);
    }
    for (const entry of cases) {
      if (!isMap(entry) || !('condition' in entry)) {
        throw new UnsupportedError(`step "${step}": a switch entry without "condition"`);
      }
      const condition = this.value(entry.condition, scope);
      if (typeof condition !== 'boolean') {
        throw new WorkflowError(`step "${step}": a condition must be true or false`, {
          tags: ['TypeError'],
        });
      }
      if (!condition) {
        continue;
      }
      const { condition: _condition, ...body } = entry;
      return this.runStep(`${step} (switch)`, body, scope);
    }
    return { kind: 'done' };
  }

  private async runFor(step: string, loop: unknown, scope: Scope): Promise<Outcome> {
    if (!isMap(loop) || typeof loop.value !== 'string' || !('in' in loop)) {
      throw new UnsupportedError(`step "${step}": a "for" without "value" and "in"`);
    }
    const items = this.value(loop.in, scope);
    if (!Array.isArray(items)) {
      throw new WorkflowError(`step "${step}": "in" is not a list`, { tags: ['TypeError'] });
    }
    for (const item of items) {
      scope.set(loop.value, item);
      const outcome = await this.runSteps(loop.steps, scope);
      if (outcome.kind === 'next' && outcome.target === 'continue') {
        continue;
      }
      if (outcome.kind === 'next' && outcome.target === 'break') {
        break;
      }
      if (outcome.kind !== 'done') {
        return outcome;
      }
    }
    scope.delete(loop.value);
    return { kind: 'done' };
  }

  private async call(name: string, args: unknown, scope: Scope, step: string): Promise<unknown> {
    const values = args === undefined ? {} : this.value(args, scope);
    if (!isMap(values)) {
      throw new UnsupportedError(`step "${step}": "args" that is not a map`);
    }
    if (name === 'sys.log') {
      return null;
    }
    if (name !== 'http.get' && name !== 'http.post') {
      throw new UnsupportedError(`step "${step}": call "${name}"`);
    }
    if (typeof values.url !== 'string') {
      throw new WorkflowError(`step "${step}": "url" must be a string`, { tags: ['TypeError'] });
    }
    const response = await this.options.http({
      method: name === 'http.get' ? 'GET' : 'POST',
      url: values.url,
      auth: values.auth,
      body: values.body,
      headers: values.headers,
      timeout: values.timeout,
    });
    if (response.code < 200 || response.code > 299) {
      throw new WorkflowError(`step "${step}": HTTP ${response.code}`, {
        tags: ['HttpError'],
        code: response.code,
        body: response.body,
      });
    }
    return response;
  }

  /** Evaluates a value from the YAML file: `${...}` strings are expressions, maps and lists recurse. */
  value(raw: unknown, scope: Scope): unknown {
    if (typeof raw === 'string') {
      const match = /^\$\{([\s\S]*)\}$/.exec(raw.trim());
      return match ? evaluate(match[1]!, scope, this.options.env) : raw;
    }
    if (Array.isArray(raw)) {
      return raw.map((item) => this.value(item, scope));
    }
    if (isMap(raw)) {
      return Object.fromEntries(
        Object.entries(raw).map(([key, item]) => [key, this.value(item, scope)]),
      );
    }
    return raw ?? null;
  }
}

// ---------------------------------------------------------------------------------------------
// Expressions

type Token =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'name'; value: string }
  | { type: 'op'; value: string };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i]!;
    if (/\s/.test(char)) {
      i++;
    } else if (char === '"' || char === "'") {
      let value = '';
      i++;
      while (i < text.length && text[i] !== char) {
        if (text[i] === '\\') {
          const escaped = text[i + 1];
          value += escaped === 'n' ? '\n' : escaped === 't' ? '\t' : (escaped ?? '');
          i += 2;
        } else {
          value += text[i];
          i++;
        }
      }
      if (i >= text.length) {
        throw new WorkflowError(`expression "${text}": a string is not closed`, null);
      }
      i++;
      tokens.push({ type: 'string', value });
    } else if (/[0-9]/.test(char)) {
      const match = /^[0-9]+(\.[0-9]+)?/.exec(text.slice(i))!;
      tokens.push({ type: 'number', value: Number(match[0]) });
      i += match[0].length;
    } else if (/[A-Za-z_]/.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(i))!;
      tokens.push({ type: 'name', value: match[0] });
      i += match[0].length;
    } else {
      const two = text.slice(i, i + 2);
      if (['==', '!=', '<=', '>='].includes(two)) {
        tokens.push({ type: 'op', value: two });
        i += 2;
      } else if ('+-*/%<>()[].,{}:'.includes(char)) {
        tokens.push({ type: 'op', value: char });
        i++;
      } else {
        throw new UnsupportedError(`expression "${text}": the character "${char}"`);
      }
    }
  }
  return tokens;
}

function evaluate(text: string, scope: Scope, env: Record<string, string>): unknown {
  const tokens = tokenize(text);
  let position = 0;

  const peek = (): Token | undefined => tokens[position];
  const isOp = (value: string): boolean => {
    const token = peek();
    return token?.type === 'op' && token.value === value;
  };
  const isWord = (value: string): boolean => {
    const token = peek();
    return token?.type === 'name' && token.value === value;
  };
  const expect = (value: string): void => {
    if (!isOp(value)) {
      throw new WorkflowError(`expression "${text}": expected "${value}"`, {
        tags: ['SyntaxError'],
      });
    }
    position++;
  };

  const parseOr = (): unknown => {
    let left = parseAnd();
    while (isWord('or')) {
      position++;
      const right = parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  };
  const parseAnd = (): unknown => {
    let left = parseNot();
    while (isWord('and')) {
      position++;
      const right = parseNot();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  };
  const parseNot = (): unknown => {
    if (isWord('not')) {
      position++;
      return !parseNot();
    }
    return parseComparison();
  };
  const parseComparison = (): unknown => {
    let left = parseAdditive();
    for (;;) {
      const token = peek();
      if (token?.type === 'op' && ['==', '!=', '<', '>', '<=', '>='].includes(token.value)) {
        position++;
        const right = parseAdditive();
        left = compare(token.value, left, right, text);
      } else if (isWord('in')) {
        position++;
        const right = parseAdditive();
        left = Array.isArray(right)
          ? right.some((item) => deepEqual(item, left))
          : isMap(right) && typeof left === 'string' && left in right;
      } else {
        return left;
      }
    }
  };
  const parseAdditive = (): unknown => {
    let left = parseMultiplicative();
    while (isOp('+') || isOp('-')) {
      const operator = (tokens[position++] as { value: string }).value;
      const right = parseMultiplicative();
      if (operator === '+' && typeof left === 'string' && typeof right === 'string') {
        left = left + right;
      } else if (operator === '+' && Array.isArray(left) && Array.isArray(right)) {
        left = [...left, ...right];
      } else if (typeof left === 'number' && typeof right === 'number') {
        left = operator === '+' ? left + right : left - right;
      } else {
        throw new WorkflowError(
          `expression "${text}": "${operator}" with ${describe(left)} and ${describe(right)}`,
          { tags: ['TypeError'] },
        );
      }
    }
    return left;
  };
  const parseMultiplicative = (): unknown => {
    let left = parseUnary();
    while (isOp('*') || isOp('/') || isOp('%')) {
      const operator = (tokens[position++] as { value: string }).value;
      const right = parseUnary();
      if (typeof left !== 'number' || typeof right !== 'number') {
        throw new WorkflowError(`expression "${text}": "${operator}" needs numbers`, {
          tags: ['TypeError'],
        });
      }
      left = operator === '*' ? left * right : operator === '/' ? left / right : left % right;
    }
    return left;
  };
  const parseUnary = (): unknown => {
    if (isOp('-')) {
      position++;
      const value = parseUnary();
      if (typeof value !== 'number') {
        throw new WorkflowError(`expression "${text}": "-" needs a number`, {
          tags: ['TypeError'],
        });
      }
      return -value;
    }
    return parsePostfix();
  };
  const parsePostfix = (): unknown => {
    const token = peek();
    if (token === undefined) {
      throw new WorkflowError(`expression "${text}" ends too early`, { tags: ['SyntaxError'] });
    }
    // A function: a dotted name followed by "(".
    if (token.type === 'name') {
      let end = position;
      const parts = [token.value];
      while (
        tokens[end + 1]?.type === 'op' &&
        (tokens[end + 1] as { value: string }).value === '.' &&
        tokens[end + 2]?.type === 'name'
      ) {
        parts.push((tokens[end + 2] as { value: string }).value);
        end += 2;
      }
      const after = tokens[end + 1];
      if (after?.type === 'op' && after.value === '(') {
        position = end + 2;
        const args: unknown[] = [];
        if (!isOp(')')) {
          args.push(parseOr());
          while (isOp(',')) {
            position++;
            args.push(parseOr());
          }
        }
        expect(')');
        return access(callFunction(parts.join('.'), args, env, text));
      }
    }
    return access(parsePrimary());
  };
  const access = (start: unknown): unknown => {
    let value = start;
    for (;;) {
      if (isOp('.')) {
        position++;
        const name = peek();
        if (name?.type !== 'name') {
          throw new WorkflowError(`expression "${text}": a name must follow "."`, {
            tags: ['SyntaxError'],
          });
        }
        position++;
        value = key(value, name.value, text);
      } else if (isOp('[')) {
        position++;
        const index = parseOr();
        expect(']');
        value = key(value, index, text);
      } else {
        return value;
      }
    }
  };
  const parsePrimary = (): unknown => {
    const token = tokens[position++]!;
    if (token.type === 'string' || token.type === 'number') {
      return token.value;
    }
    if (token.type === 'name') {
      if (token.value === 'true') return true;
      if (token.value === 'false') return false;
      if (token.value === 'null') return null;
      if (!scope.has(token.value)) {
        throw new WorkflowError(`expression "${text}": the variable "${token.value}" is not set`, {
          tags: ['KeyError'],
        });
      }
      return scope.get(token.value);
    }
    if (token.value === '(') {
      const value = parseOr();
      expect(')');
      return value;
    }
    if (token.value === '[') {
      const items: unknown[] = [];
      if (!isOp(']')) {
        items.push(parseOr());
        while (isOp(',')) {
          position++;
          items.push(parseOr());
        }
      }
      expect(']');
      return items;
    }
    if (token.value === '{') {
      const map: Record<string, unknown> = {};
      if (!isOp('}')) {
        do {
          if (isOp(',')) position++;
          const name = tokens[position++];
          if (name?.type !== 'string') {
            throw new WorkflowError(`expression "${text}": a map key must be a string`, {
              tags: ['SyntaxError'],
            });
          }
          expect(':');
          map[name.value] = parseOr();
        } while (isOp(','));
      }
      expect('}');
      return map;
    }
    throw new WorkflowError(`expression "${text}": unexpected "${token.value}"`, {
      tags: ['SyntaxError'],
    });
  };

  const result = parseOr();
  if (position !== tokens.length) {
    throw new WorkflowError(`expression "${text}": unexpected "${String(peek()?.value)}"`, {
      tags: ['SyntaxError'],
    });
  }
  return result;
}

function callFunction(
  name: string,
  args: unknown[],
  env: Record<string, string>,
  text: string,
): unknown {
  const string = (index: number): string => {
    const value = args[index];
    if (typeof value !== 'string') {
      throw new WorkflowError(
        `expression "${text}": ${name} needs a string, got ${describe(value)}`,
        {
          tags: ['TypeError'],
        },
      );
    }
    return value;
  };
  switch (name) {
    case 'sys.get_env':
      return env[string(0)] ?? (args.length > 1 ? args[1] : null);
    case 'text.to_lower':
      return string(0).toLowerCase();
    case 'text.to_upper':
      return string(0).toUpperCase();
    case 'text.match_regex':
      return new RegExp(string(1)).test(string(0));
    case 'text.find_all':
      return [...string(0).matchAll(new RegExp(escapeRegex(string(1)), 'g'))].map((m) => ({
        index: m.index,
        match: m[0],
      }));
    case 'text.split':
      return string(0).split(string(1));
    case 'text.replace_all':
      return string(0).split(string(1)).join(string(2));
    case 'text.replace_all_regex':
      return string(0).replace(new RegExp(string(1), 'g'), string(2));
    case 'text.substring': {
      const [, start, end] = args as [unknown, number, number];
      return string(0).slice(start, end);
    }
    case 'map.get': {
      const [map, keys] = args;
      let value: unknown = map;
      for (const part of Array.isArray(keys) ? keys : [keys]) {
        if (!isMap(value) || typeof part !== 'string' || !(part in value)) {
          return null;
        }
        value = value[part];
      }
      return value ?? null;
    }
    case 'default':
      return args[0] ?? args[1] ?? null;
    case 'len': {
      const value = args[0];
      if (typeof value === 'string' || Array.isArray(value)) return value.length;
      if (isMap(value)) return Object.keys(value).length;
      throw new WorkflowError(`expression "${text}": len of ${describe(value)}`, {
        tags: ['TypeError'],
      });
    }
    case 'keys':
      return isMap(args[0]) ? Object.keys(args[0]) : [];
    case 'string':
      return typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]);
    case 'json.encode_to_string':
      return JSON.stringify(args[0]);
    default:
      throw new UnsupportedError(`expression "${text}": the function ${name}`);
  }
}

function key(value: unknown, index: unknown, text: string): unknown {
  if (Array.isArray(value) && typeof index === 'number') {
    if (index < 0 || index >= value.length || !Number.isInteger(index)) {
      throw new WorkflowError(`expression "${text}": index ${index} is out of range`, {
        tags: ['IndexError'],
      });
    }
    return value[index];
  }
  if (isMap(value) && typeof index === 'string') {
    if (!(index in value)) {
      throw new WorkflowError(`expression "${text}": the key "${index}" is missing`, {
        tags: ['KeyError'],
      });
    }
    return value[index];
  }
  throw new WorkflowError(`expression "${text}": ${describe(value)} has no key ${String(index)}`, {
    tags: ['TypeError'],
  });
}

function compare(operator: string, left: unknown, right: unknown, text: string): boolean {
  if (operator === '==') return deepEqual(left, right);
  if (operator === '!=') return !deepEqual(left, right);
  if (
    !(typeof left === 'number' && typeof right === 'number') &&
    !(typeof left === 'string' && typeof right === 'string')
  ) {
    throw new WorkflowError(`expression "${text}": "${operator}" with ${describe(left)}`, {
      tags: ['TypeError'],
    });
  }
  if (operator === '<') return left < right;
  if (operator === '>') return left > right;
  if (operator === '<=') return left <= right;
  return left >= right;
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function describe(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'a list';
  return typeof value === 'object' ? 'a map' : `the ${typeof value} ${JSON.stringify(value)}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
