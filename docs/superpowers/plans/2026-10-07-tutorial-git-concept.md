# Tutorial Git Concept, check-chapter Skill, and Chapter 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared base on `main`, the `check-chapter` skill, and the `chapter-01-starter` / `chapter-01-solution` branch pair with `v1` tags, as the first proof of the tutorial's branch-and-tag scheme.

**Architecture:** One linear Git chain `main → chapter-01-starter → chapter-01-solution`. `main` carries everything chapters share (README, skill, criteria, chain verification script); each chapter branch adds commits on top of the previous one. A bash script verifies the chain's invariants in throwaway worktrees, and a Claude Code project skill checks a learner's working tree against a per-chapter criteria file.

**Tech Stack:** Git 2.38+ (`rebase --update-refs`), bash 3.2+, Node.js 26, TypeScript 7 (`tsc`), `@google/adk` 2.1, `@google/genai`, `zod` 4, `dotenv`, `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-07-tutorial-git-concept-design.md`

## Global Constraints

- Branch names: `chapter-NN-starter`, `chapter-NN-solution`. Tag names: `chapter-NN-starter-vK`, `chapter-NN-solution-vK`. Tags are never moved or deleted.
- Learner tasks are marked `// TODO(chNN-k): …`. Chapter 1 uses `ch01-1` to `ch01-6`.
- Each starter commits `.tutorial/chapter` containing the two-digit chapter number. `main` has no marker.
- `main` contains no chapter code (no `src/`, no `scripts/test-tools.ts`).
- Every starter passes `tsc --noEmit`. Every solution passes `tsc --noEmit` and has no `TODO(chNN-` marker for its own chapter under `src` or `scripts`. Solutions need not run and get no tests.
- `git diff chapter-01-starter chapter-01-solution` touches only `src/tools/vision-inspector.ts` and `src/tools/price-evaluator.ts`.
- No test image is committed.
- The skill never edits the learner's code, never reads any `chapter-NN-solution` ref, and never prints solution code.
- All work happens in a dedicated worktree (the **chain worktree**). The primary checkout holds the user's own staged files (`specs/de/*`) and must not be touched: no `git add -A`, no branch switching, no stash there.
- Nothing is pushed without the user's explicit confirmation.
- Do not change the `adk-web` submodule.

## Review Focus

1. **Learner works on a branch with any name** (`my-chapter-01`): the skill must identify the chapter from `.tutorial/chapter`, not from the branch name. Pinned in Task 3, Step 12.
2. **Learner deletes a `TODO` comment without doing the task**: the criterion must still be reported unmet, because the requirement is not satisfied. Pinned in Task 3, Step 12.
3. **No API key, or the learner declines the live test**: live criteria are reported "unverified" and the verdict is "met with unverified items", never plain "met". Pinned in Task 4, Step 8.
4. **Test script called with no path or a path that does not exist**: a readable message, exit code 1, and no Gemini call. Pinned in Task 3, Step 8.
5. **Maintainer fixes something on `main` after chapters exist**: `git rebase --update-refs` must move both chapter branches and keep the chain intact. Pinned in Task 5, Step 2.

## File Structure

On `main`:

| File | Responsibility |
|---|---|
| `README.md` | What the tutorial is; learner flow; maintainer flow |
| `.env.example` | Names the one required variable |
| `scripts/verify-chain.sh` | Checks the four chain invariants; exits non-zero naming branch and invariant |
| `.claude/skills/check-chapter/SKILL.md` | Skill procedure, report format, hard rules |
| `.claude/skills/check-chapter/chapters/chapter-01.md` | Chapter 1 criteria |

Added on `chapter-01-starter`:

| File | Responsibility |
|---|---|
| `package.json`, `package-lock.json` | ESM, dependencies, `typecheck` and `test:tools` scripts |
| `tsconfig.json` | ESM compiler settings for `src` and `scripts` |
| `src/config.ts` | Loads `.env`; exports `GEMINI_MODEL` and `getGenAI()` |
| `src/tools/vision-inspector.ts` | Vision tool: schemas, `inspectImage`, `visionInspectorTool` (stubs + TODOs) |
| `src/tools/price-evaluator.ts` | Price tool: schemas, `evaluatePrice`, `priceEvaluatorTool` (stubs + TODOs) |
| `scripts/test-tools.ts` | Live harness: runs both tools on one image and validates with their schemas |
| `.tutorial/chapter` | `01` |

Changed on `chapter-01-solution`: the two tool files only.

`src/config.ts` exports a `getGenAI()` client factory in addition to the model constant the spec names. It is provided setup, so the learner's TODOs stay about tools.

---

### Task 1: Shared base on `main`

**Files:**
- Create: `scripts/verify-chain.sh`
- Create: `.env.example`
- Create: `README.md`

**Interfaces:**
- Consumes: branch `spec/tutorial-git-concept` (holds `docs/specs/` and `docs/superpowers/`).
- Produces: `scripts/verify-chain.sh [branch ...]`. With no arguments it checks `main chapter-01-starter chapter-01-solution`; with arguments it checks exactly those branches in that order. Prints `ok   [branch]` per verified chapter branch and `OK: chain verified (…)` on success. On the first violation prints `FAIL [branch] <reason>` to stderr and exits 1.

- [ ] **Step 1: Create the chain worktree on `main`**

REQUIRED SUB-SKILL: superpowers:using-git-worktrees. The worktree must have `main` checked out. If the skill is unavailable, run this from the primary checkout:

```bash
git worktree add ../kleinanzeigen-agent-chain main
cd ../kleinanzeigen-agent-chain
```

Every later command in this plan runs from the chain worktree root.

- [ ] **Step 2: Bring the specs onto `main` and install dependencies**

```bash
git merge --ff-only spec/tutorial-git-concept
npm ci
```

Expected: `git log --oneline -1` shows the newest commit of `spec/tutorial-git-concept`; `ls docs/specs` lists `tutorial_content.md` and `tutorial_idea_git_concept.md`.

- [ ] **Step 3: Write `scripts/verify-chain.sh`**

```bash
#!/usr/bin/env bash
# Verifies the invariants of the tutorial's chapter chain.
# Usage: scripts/verify-chain.sh [branch ...]
# Without arguments the full chain below is checked, in order.
set -euo pipefail

CHAIN=(main chapter-01-starter chapter-01-solution)
if [ "$#" -gt 0 ]; then
  CHAIN=("$@")
fi

fail() {
  echo "FAIL [$1] $2" >&2
  exit 1
}

repo_root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
cleanup() {
  for dir in "$tmp"/*; do
    if [ -d "$dir" ]; then
      git -C "$repo_root" worktree remove --force "$dir" >/dev/null 2>&1 || true
    fi
  done
  rm -rf "$tmp"
}
trap cleanup EXIT

for branch in "${CHAIN[@]}"; do
  git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null ||
    fail "$branch" "branch does not exist"
done

# Invariant 1: each branch is an ancestor of the next.
for ((i = 1; i < ${#CHAIN[@]}; i++)); do
  previous=${CHAIN[i - 1]}
  current=${CHAIN[i]}
  git merge-base --is-ancestor "$previous" "$current" ||
    fail "$current" "invariant 1: $previous is not an ancestor"
done

for branch in "${CHAIN[@]}"; do
  case "$branch" in
    chapter-*-starter | chapter-*-solution) ;;
    *) continue ;;
  esac
  number=${branch#chapter-}
  number=${number%%-*}
  kind=${branch##*-}

  # Invariant 4: the chapter marker matches the branch name.
  marker=$(git show "$branch:.tutorial/chapter" 2>/dev/null | tr -d '[:space:]' || true)
  [ "$marker" = "$number" ] ||
    fail "$branch" "invariant 4: .tutorial/chapter is '$marker', expected '$number'"

  # Invariant 3: a solution has no TODO left for its own chapter.
  if [ "$kind" = solution ] && git grep -q "TODO(ch$number-" "$branch" -- src scripts; then
    fail "$branch" "invariant 3: TODO(ch$number-…) markers remain"
  fi

  # Invariants 2 and 3: the branch typechecks.
  worktree="$tmp/$branch"
  git worktree add --detach --quiet "$worktree" "$branch"
  (cd "$worktree" && npm ci --silent >/dev/null 2>&1) ||
    fail "$branch" "npm ci failed"
  (cd "$worktree" && npx tsc --noEmit) ||
    fail "$branch" "invariant 2: tsc --noEmit failed"
  echo "ok   [$branch]"
done

echo "OK: chain verified (${CHAIN[*]})"
```

```bash
chmod +x scripts/verify-chain.sh
```

- [ ] **Step 4: Run it against the full chain and confirm it fails for the right reason**

Run: `scripts/verify-chain.sh; echo "exit=$?"`
Expected:
```
FAIL [chapter-01-starter] branch does not exist
exit=1
```

- [ ] **Step 5: Run it against `main` alone and confirm it passes**

Run: `scripts/verify-chain.sh main; echo "exit=$?"`
Expected:
```
OK: chain verified (main)
exit=0
```

- [ ] **Step 6: Write `.env.example`**

```
# Google AI Studio API key. Copy this file to .env and fill it in.
GEMINI_API_KEY=
```

- [ ] **Step 7: Write `README.md`**

````markdown
# Kleinanzeigen Agent: an ADK TypeScript tutorial

Build an agent that turns a photo of an item into a published Kleinanzeigen
listing, one chapter at a time. The repository root is the project. Chapters
are branches, not folders.

The chapter content is in [docs/specs/tutorial_content.md](docs/specs/tutorial_content.md).

## How the chapters are laid out

```
main ── chapter-01-starter ── chapter-01-solution ── chapter-02-starter ── …
```

- `chapter-NN-starter` has the types and boilerplate for a chapter, with the
  work you do marked as `// TODO(chNN-k)`.
- `chapter-NN-solution` is a reference implementation. It typechecks but is
  not tested, so read it as an example and not as the only right answer.
- Each starter is built on the previous chapter's solution.
- Tags such as `chapter-01-starter-v1` are fixed snapshots. Branches may be
  rebased when the tutorial is corrected; tags never move.

## Working through a chapter

You need Node.js 26 or newer and a Google AI Studio API key.

```sh
git switch -c my-chapter-01 chapter-01-starter-v1
npm ci
cp .env.example .env    # then add your GEMINI_API_KEY
```

Work through the `TODO(ch01-…)` blocks. Check yourself at any time:

```sh
npm run typecheck
npm run test:tools -- path/to/photo.jpg
```

In Claude Code, ask "is my chapter done?" to run the `check-chapter` skill. It
tells you which goals are still open and where to look. It does not show you
the solution.

To see the reference solution:

```sh
git diff chapter-01-starter chapter-01-solution
```

Start the next chapter from its own starter tag. Your work stays on your
branch:

```sh
git switch -c my-chapter-02 chapter-02-starter-v1
```

## Maintaining the chain

1. Commit the fix on the earliest branch it belongs to (`main` for anything
   shared, such as this README or the skill).
2. Replay the rest of the chain onto it. From the last branch in the chain:

   ```sh
   git switch chapter-01-solution
   git rebase --update-refs <branch-you-fixed>
   ```

3. Verify: `scripts/verify-chain.sh`
4. Cut the next release on every chain branch, for example:

   ```sh
   git tag -a chapter-01-starter-v2 chapter-01-starter -m "Chapter 1 starter, release v2"
   git tag -a chapter-01-solution-v2 chapter-01-solution -m "Chapter 1 solution, release v2"
   ```

5. Push: `git push --force-with-lease origin main chapter-01-starter chapter-01-solution`
   and `git push origin --tags`.

When you add a chapter, append its two branches to `CHAIN` in
`scripts/verify-chain.sh` and add its criteria file under
`.claude/skills/check-chapter/chapters/`.

Design notes live in `docs/superpowers/`.
````

- [ ] **Step 8: Confirm `main` has no chapter code**

Run: `ls src scripts`
Expected: `src` is absent or empty; `scripts` contains only `verify-chain.sh`.

- [ ] **Step 9: Commit**

```bash
git add scripts/verify-chain.sh .env.example README.md
git commit -m "Add shared tutorial base: README, env example, chain verification"
```

---

### Task 2: The `check-chapter` skill

**Files:**
- Create: `.claude/skills/check-chapter/SKILL.md`
- Create: `.claude/skills/check-chapter/chapters/chapter-01.md`

**Interfaces:**
- Consumes: `.tutorial/chapter` (two-digit chapter number, written by Task 3).
- Produces: a criteria file format with the fields ID, Type, Target, Requirement, Hint, Docs; criterion IDs `ch01-1` … `ch01-6`, `ch01-tc`, `ch01-live-1`, `ch01-live-2`. Task 3 must use exactly these TODO IDs and these export names: `visionInspectorInputSchema`, `visionInspectorOutputSchema`, `inspectImage`, `visionInspectorTool`, `priceEvaluatorInputSchema`, `priceEvaluatorOutputSchema`, `evaluatePrice`, `priceEvaluatorTool`.

REQUIRED SUB-SKILL: superpowers:writing-skills, for its checks on skill structure and wording. The content below is the agreed content; keep it.

- [ ] **Step 1: Write `.claude/skills/check-chapter/SKILL.md`**

````markdown
---
name: check-chapter
description: Use when a learner of this ADK tutorial asks whether their chapter is done, what is still missing, or for a hint on the current chapter. Checks the working tree against the chapter's criteria and reports the gaps with pointers, never with solution code.
---

# Check Chapter

Tell the learner whether their working tree meets the goal of the tutorial
chapter they are on, and where to look for whatever is missing.

## Hard rules

- Never edit, create, or delete the learner's files.
- Never read a `chapter-NN-solution` branch or tag: no `git show`, `git diff`,
  `git log -p`, `git checkout`, or `git grep` against it, even when asked. Give
  the learner the command to run instead.
- Never write solution code in the report. Name the gap, the file, the TODO,
  and the docs link. A hint describes the concept, not the code.
- Never print the value of an API key.

## Procedure

1. Read `.tutorial/chapter` and trim whitespace. It holds a two-digit chapter
   number such as `01`. Do not infer the chapter from the branch name.

   If the file is missing, the learner is not on a chapter branch. Find the
   newest starter tag with
   `git tag --list 'chapter-01-starter-v*' --sort=-version:refname`. Tell the
   learner to run `git switch -c my-chapter-01 <that tag>`, or use the branch
   `chapter-01-starter` when no tag exists. Stop here.

2. Read `chapters/chapter-NN.md` next to this file. If it does not exist, say
   that chapter NN has no criteria yet. Stop here.

3. For each `static` criterion, read the target file in the working tree and
   decide whether the requirement holds. A criterion is **unmet** when its
   `TODO(chNN-k)` marker is still in the code, **or** when the requirement is
   not satisfied. A removed TODO comment does not make a criterion met: an
   empty schema or a function that still throws "not implemented" is unmet.

   Judge the requirement, not the wording. The learner's field descriptions,
   prompt text, helper functions, and approach may differ from any reference.

4. For the `typecheck` criterion, run `npx tsc --noEmit`. Met when it exits 0.
   When it fails, list the first errors with file and line.

5. For `live` criteria, check that the key named in the criteria file is set:
   either in the environment or as a non-empty value in `.env`. Then ask the
   learner whether to run the live test command, and for the path to a photo.
   The command calls the Gemini API and uses their quota.

   Mark every `live` criterion **unverified** when the key is missing, the
   learner declines, or no photo path is given. Otherwise run the command and
   judge each `live` criterion from its output.

6. Report.

## Report format

Start with one verdict line:

- **Chapter NN: met** when every criterion is met.
- **Chapter NN: not yet met** when at least one criterion is unmet.
- **Chapter NN: met with unverified items** when nothing is unmet but at least
  one criterion is unverified.

Then one line per criterion, in the order of the criteria file:

```
[met]        ch01-1  Vision input schema
[unmet]      ch01-2  Vision output schema
[unverified] ch01-live-1  Vision tool returns a valid result
```

Then, for each unmet criterion, a short block:

```
ch01-2  src/tools/vision-inspector.ts  TODO(ch01-2)
Missing: <what the requirement needs that the code does not have yet>
Hint: <the hint from the criteria file>
Docs: <the docs link from the criteria file>
```

End with:

```
To compare with the reference solution, run:
git diff chapter-NN-starter chapter-NN-solution
```
````

- [ ] **Step 2: Write `.claude/skills/check-chapter/chapters/chapter-01.md`**

```markdown
# Chapter 1 criteria: Foundation, Setup & Tool Design

Goal: two ADK tools, `VisionInspectorTool` and `PriceEvaluatorTool`, with
typed Zod input and output schemas, turning a photo and a price question into
reliable JSON.

Live test command: `npx tsx scripts/test-tools.ts <path-to-photo>`
Required key: `GEMINI_API_KEY`

## ch01-1 Vision input schema

- Type: static
- Target: `src/tools/vision-inspector.ts`, export `visionInspectorInputSchema`
- Requirement: a Zod object with a string field `imagePath` (a local path or a
  GCS URI) and an optional `mimeType`.
- Hint: The schema is the only description of the arguments the model gets, so
  each field needs a type and a `.describe()` text.
- Docs: https://adk.dev/live/tools/

## ch01-2 Vision output schema

- Type: static
- Target: `src/tools/vision-inspector.ts`, export `visionInspectorOutputSchema`
- Requirement: a Zod object with `title` (string), `detectedCategory`
  (string), `condition` (limited to new, used, defective), and `keyAttributes`
  (array of strings).
- Hint: A closed set of values is an enum, not a free string. That is what
  lets later chapters branch on the condition safely.
- Docs: https://zod.dev/

## ch01-3 Vision extraction

- Type: static
- Target: `src/tools/vision-inspector.ts`, export `inspectImage`
- Requirement: sends the image at `imagePath` to Gemini and returns a value
  parsed with `visionInspectorOutputSchema`. It no longer throws
  "not implemented".
- Hint: A multimodal request is one user message with two parts, the image and
  the instruction. Ask Gemini for JSON and validate what comes back before
  returning it.
- Docs: https://ai.google.dev/gemini-api/docs/image-understanding

## ch01-4 Price input schema

- Type: static
- Target: `src/tools/price-evaluator.ts`, export `priceEvaluatorInputSchema`
- Requirement: a Zod object with `itemQuery` (string) and `condition`.
- Hint: The agent will fill these from the vision result, so use the same set
  of condition values as the vision output.
- Docs: https://adk.dev/live/tools/

## ch01-5 Price output schema

- Type: static
- Target: `src/tools/price-evaluator.ts`, export `priceEvaluatorOutputSchema`
- Requirement: a Zod object with numeric `priceMin`, `priceMax`, and
  `recommendedPrice`, and a `currency`.
- Hint: Prices are numbers, not strings with a currency sign. Keep the
  currency in its own field.
- Docs: https://zod.dev/

## ch01-6 Price research

- Type: static
- Target: `src/tools/price-evaluator.ts`, export `evaluatePrice`
- Requirement: derives a used-price range for `itemQuery` and `condition` from
  a real source (for example Gemini with Google Search grounding) and returns
  a value parsed with `priceEvaluatorOutputSchema`. Hard-coded prices do not
  count. It no longer throws "not implemented".
- Hint: Let the model look up current listings instead of guessing from
  memory, then validate its answer like any other untrusted input.
- Docs: https://ai.google.dev/gemini-api/docs/google-search

## ch01-tc Typecheck

- Type: typecheck
- Target: whole project
- Requirement: `npx tsc --noEmit` exits 0.
- Hint: Read the first error only; later ones often follow from it.
- Docs: https://adk.dev/tutorials/multi-tool-agent/

## ch01-live-1 Vision tool returns a valid result

- Type: live
- Target: `scripts/test-tools.ts`
- Requirement: the output contains a `VisionInspectorTool result:` line with
  plausible attributes for the photo, and the script does not fail before it.
- Hint: If parsing fails, compare the keys Gemini returned with your output
  schema.
- Docs: https://ai.google.dev/gemini-api/docs/structured-output

## ch01-live-2 Price tool returns a numeric range

- Type: live
- Target: `scripts/test-tools.ts`
- Requirement: the output contains a `PriceEvaluatorTool result:` line with
  numeric `priceMin`, `priceMax`, and `recommendedPrice`, and the script exits
  0.
- Hint: If the answer is prose instead of JSON, tighten the instruction about
  the output format.
- Docs: https://ai.google.dev/gemini-api/docs/google-search
```

- [ ] **Step 3: Run the skill on `main` and confirm it stops with the right pointer**

Dispatch a fresh subagent (or, when executing inline, do it yourself) with this prompt, replacing `<worktree>` with the absolute path of the chain worktree:

> You are testing a Claude Code skill. Working directory: `<worktree>`. A learner asks: "Is my chapter done?" Read `.claude/skills/check-chapter/SKILL.md` and follow it exactly. If the skill tells you to ask the learner about the live test, assume the answer is "no". Do not modify any file. Return the report exactly as you would show it to the learner, then list every command you ran.

Expected: the report says the learner is not on a chapter branch and tells them to run `git switch -c my-chapter-01 chapter-01-starter` (no tag exists yet). No criteria are listed. No command touched a `chapter-01-solution` ref.

If the report differs, fix the wording of step 1 in `SKILL.md` and run this step again.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/check-chapter
git commit -m "Add check-chapter skill with chapter 1 criteria"
```

---

### Task 3: `chapter-01-starter`

**Files:**
- Modify: `package.json`, `package-lock.json`, `tsconfig.json`
- Create: `src/config.ts`
- Create: `src/tools/vision-inspector.ts`
- Create: `src/tools/price-evaluator.ts`
- Create: `scripts/test-tools.ts`
- Create: `.tutorial/chapter`

**Interfaces:**
- Consumes: `scripts/verify-chain.sh [branch ...]` from Task 1; criterion IDs and export names from Task 2.
- Produces:
  - `src/config.ts`: `export const GEMINI_MODEL: string`, `export function getGenAI(): GoogleGenAI`
  - `src/tools/vision-inspector.ts`: `visionInspectorInputSchema`, `visionInspectorOutputSchema`, `type VisionInspectorInput`, `type VisionInspectorOutput`, `inspectImage(input: VisionInspectorInput): Promise<VisionInspectorOutput>`, `visionInspectorTool: FunctionTool`
  - `src/tools/price-evaluator.ts`: `priceEvaluatorInputSchema`, `priceEvaluatorOutputSchema`, `type PriceEvaluatorInput`, `type PriceEvaluatorOutput`, `evaluatePrice(input: PriceEvaluatorInput): Promise<PriceEvaluatorOutput>`, `priceEvaluatorTool: FunctionTool`
  - npm scripts `typecheck` and `test:tools`

- [ ] **Step 1: Create the branch**

```bash
git switch -c chapter-01-starter main
```

- [ ] **Step 2: Add dependencies and scripts**

```bash
npm install zod @google/genai dotenv
npm install --save-dev tsx @types/node
npm pkg set type=module
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set "scripts.test:tools=tsx scripts/test-tools.ts"
```

Expected: `package.json` has `"type": "module"`, the two new scripts, `zod`, `@google/genai`, `dotenv` under `dependencies`, and `tsx`, `@types/node` under `devDependencies`.

- [ ] **Step 3: Replace `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "rootDir": ".",
    "outDir": "dist"
  },
  "include": ["src", "scripts"]
}
```

- [ ] **Step 4: Write `src/config.ts`**

```ts
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ quiet: true });

/** Gemini model used by every tool. Override with GEMINI_MODEL in .env. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

/** Returns a Gemini client, or throws a readable error when no API key is configured. */
export function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.');
  }
  return new GoogleGenAI({ apiKey });
}
```

- [ ] **Step 5: Write the test harness `scripts/test-tools.ts`**

```ts
import { existsSync } from 'node:fs';
import '../src/config.js';
import {
  evaluatePrice,
  priceEvaluatorInputSchema,
  priceEvaluatorOutputSchema,
  priceEvaluatorTool,
} from '../src/tools/price-evaluator.js';
import {
  inspectImage,
  visionInspectorInputSchema,
  visionInspectorOutputSchema,
  visionInspectorTool,
} from '../src/tools/vision-inspector.js';

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: npm run test:tools -- <path-to-image>');
  process.exit(1);
}
if (!imagePath.startsWith('gs://') && !existsSync(imagePath)) {
  console.error(`Image not found: ${imagePath}`);
  process.exit(1);
}

console.log(`Tools under test: ${visionInspectorTool.name}, ${priceEvaluatorTool.name}`);

const visionInput = visionInspectorInputSchema.parse({ imagePath });
const vision = visionInspectorOutputSchema.parse(await inspectImage(visionInput));
console.log('VisionInspectorTool result:', vision);

// The schemas are empty in the starter, so the fields are read untyped here.
const fields = vision as Record<string, unknown>;
const attributes = Array.isArray(fields.keyAttributes) ? fields.keyAttributes : [];
const priceInput = priceEvaluatorInputSchema.parse({
  itemQuery: [fields.title, ...attributes].filter(Boolean).join(' '),
  condition: fields.condition,
});
const price = priceEvaluatorOutputSchema.parse(await evaluatePrice(priceInput));
console.log('PriceEvaluatorTool result:', price);
```

- [ ] **Step 6: Run the typecheck and confirm it fails because the tools do not exist yet**

Run: `npm run typecheck`
Expected: FAIL with `Cannot find module '../src/tools/price-evaluator.js'` and `Cannot find module '../src/tools/vision-inspector.js'`.

- [ ] **Step 7: Write the two tool stubs**

`src/tools/vision-inspector.ts`:

```ts
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

// TODO(ch01-1): Define the input schema of the VisionInspectorTool.
// It needs `imagePath` (a local file path or a gs:// URI) and an optional
// `mimeType`. Give every field a `.describe()` text: the schema is all the
// model sees of your tool's arguments.
export const visionInspectorInputSchema = z.object({});

// TODO(ch01-2): Define the output schema of the VisionInspectorTool.
// It needs `title` (a listing title suggestion), `detectedCategory`,
// `condition` (one of "new", "used", "defective") and `keyAttributes`
// (an array of strings such as brand, model, color).
export const visionInspectorOutputSchema = z.object({});

export type VisionInspectorInput = z.infer<typeof visionInspectorInputSchema>;
export type VisionInspectorOutput = z.infer<typeof visionInspectorOutputSchema>;

// TODO(ch01-3): Implement the multimodal extraction.
// Read the image, send it to Gemini together with an instruction, ask for
// JSON that matches the output schema, and return the result parsed with
// `visionInspectorOutputSchema`. `getGenAI()` and `GEMINI_MODEL` from
// `../config.js` give you the client and the model.
export async function inspectImage(input: VisionInspectorInput): Promise<VisionInspectorOutput> {
  throw new Error('inspectImage is not implemented yet (TODO ch01-3).');
}

export const visionInspectorTool = new FunctionTool({
  name: 'vision_inspector',
  description:
    'Analyzes a photo of an item and returns a suggested title, category, condition and key attributes.',
  parameters: visionInspectorInputSchema,
  execute: inspectImage,
});
```

`src/tools/price-evaluator.ts`:

```ts
import { FunctionTool } from '@google/adk';
import { z } from 'zod';

// TODO(ch01-4): Define the input schema of the PriceEvaluatorTool.
// It needs `itemQuery` (search terms for the item) and `condition`
// (one of "new", "used", "defective").
export const priceEvaluatorInputSchema = z.object({});

// TODO(ch01-5): Define the output schema of the PriceEvaluatorTool.
// It needs the numbers `priceMin`, `priceMax` and `recommendedPrice`, and a
// `currency` code.
export const priceEvaluatorOutputSchema = z.object({});

export type PriceEvaluatorInput = z.infer<typeof priceEvaluatorInputSchema>;
export type PriceEvaluatorOutput = z.infer<typeof priceEvaluatorOutputSchema>;

// TODO(ch01-6): Implement the price research.
// Find a realistic second-hand price range for the item in its condition and
// return it parsed with `priceEvaluatorOutputSchema`. Use a real source, for
// example Gemini with Google Search grounding, not fixed numbers.
// `getGenAI()` and `GEMINI_MODEL` from `../config.js` give you the client and
// the model.
export async function evaluatePrice(input: PriceEvaluatorInput): Promise<PriceEvaluatorOutput> {
  throw new Error('evaluatePrice is not implemented yet (TODO ch01-6).');
}

export const priceEvaluatorTool = new FunctionTool({
  name: 'price_evaluator',
  description: 'Researches a realistic second-hand price range for an item in a given condition.',
  parameters: priceEvaluatorInputSchema,
  execute: evaluatePrice,
});
```

- [ ] **Step 8: Run the typecheck and the harness's guard paths**

Run: `npm run typecheck`
Expected: exits 0 with no errors.

Run: `npx tsx scripts/test-tools.ts; echo "exit=$?"`
Expected: `Usage: npm run test:tools -- <path-to-image>` and `exit=1`.

Run: `npx tsx scripts/test-tools.ts does-not-exist.jpg; echo "exit=$?"`
Expected: `Image not found: does-not-exist.jpg` and `exit=1`.

Run: `npx tsx scripts/test-tools.ts package.json; echo "exit=$?"`
Expected: `Tools under test: vision_inspector, price_evaluator`, then an error containing `inspectImage is not implemented yet (TODO ch01-3).` and a non-zero exit. No network call is made.

- [ ] **Step 9: Commit the project setup and stubs**

```bash
git add package.json package-lock.json tsconfig.json src scripts/test-tools.ts
git commit -m "Chapter 1 starter: project setup, tool stubs, and test harness"
```

- [ ] **Step 10: Verify the chain and confirm it fails on the missing marker**

Run: `scripts/verify-chain.sh main chapter-01-starter; echo "exit=$?"`
Expected:
```
FAIL [chapter-01-starter] invariant 4: .tutorial/chapter is '', expected '01'
exit=1
```

- [ ] **Step 11: Add the chapter marker, verify, and commit**

```bash
mkdir -p .tutorial
echo 01 > .tutorial/chapter
git add .tutorial/chapter
git commit -m "Chapter 1 starter: add chapter marker"
scripts/verify-chain.sh main chapter-01-starter; echo "exit=$?"
```

Expected:
```
ok   [chapter-01-starter]
OK: chain verified (main chapter-01-starter)
exit=0
```

- [ ] **Step 12: Run the skill as a learner would, on a work branch with a deleted TODO comment**

```bash
git switch -c my-chapter-01 chapter-01-starter
```

In `src/tools/vision-inspector.ts`, delete the four comment lines of the `TODO(ch01-1)` block and leave `export const visionInspectorInputSchema = z.object({});` unchanged. Do not commit.

Dispatch a fresh subagent (or do it yourself when executing inline) with this prompt, replacing `<worktree>` with the absolute path of the chain worktree:

> You are testing a Claude Code skill. Working directory: `<worktree>`. A learner asks: "Is my chapter done?" Read `.claude/skills/check-chapter/SKILL.md` and follow it exactly. If the skill tells you to ask the learner about the live test, assume the answer is "no". Do not modify any file. Return the report exactly as you would show it to the learner, then list every command you ran.

Expected:
- Verdict line: `Chapter 01: not yet met`.
- `ch01-1` to `ch01-6` are `[unmet]`, including `ch01-1` whose TODO comment was deleted.
- `ch01-tc` is `[met]`.
- `ch01-live-1` and `ch01-live-2` are `[unverified]`.
- Each unmet block names the file, the TODO ID, a hint, and a docs link, and contains no implementation code.
- The report ends with `git diff chapter-01-starter chapter-01-solution`.
- No command the subagent ran touched a `chapter-01-solution` ref, and `git status --short` shows only the edit made above.

If a result differs, fix the corresponding instruction in `SKILL.md` or `chapter-01.md` on `main` (commit there, then `git switch chapter-01-starter && git rebase main`) and run this step again.

- [ ] **Step 13: Remove the throwaway work branch**

```bash
git restore src/tools/vision-inspector.ts
git switch chapter-01-starter
git branch -D my-chapter-01
```

Expected: `git status --short` prints nothing.

---

### Task 4: `chapter-01-solution`

**Files:**
- Modify: `src/tools/vision-inspector.ts`
- Modify: `src/tools/price-evaluator.ts`

**Interfaces:**
- Consumes: `GEMINI_MODEL` and `getGenAI()` from `src/config.ts`; the export names and signatures from Task 3; `scripts/verify-chain.sh` from Task 1.
- Produces: the reference implementation. Export names and signatures are unchanged from Task 3.

- [ ] **Step 1: Create the branch**

```bash
git switch -c chapter-01-solution chapter-01-starter
```

- [ ] **Step 2: Verify the chain and confirm it fails because the TODOs are still there**

Run: `scripts/verify-chain.sh; echo "exit=$?"`
Expected:
```
ok   [chapter-01-starter]
FAIL [chapter-01-solution] invariant 3: TODO(ch01-…) markers remain
exit=1
```

- [ ] **Step 3: Replace `src/tools/vision-inspector.ts` with the reference implementation**

```ts
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { FunctionTool } from '@google/adk';
import { createPartFromBase64, createPartFromUri, createUserContent } from '@google/genai';
import { z } from 'zod';
import { GEMINI_MODEL, getGenAI } from '../config.js';

export const visionInspectorInputSchema = z.object({
  imagePath: z.string().describe('Local file path or gs:// URI of the item photo.'),
  mimeType: z
    .string()
    .optional()
    .describe('MIME type of the image, e.g. "image/jpeg". Inferred from the file extension when omitted.'),
});

export const visionInspectorOutputSchema = z.object({
  title: z.string().describe('Suggested listing title, at most 65 characters.'),
  detectedCategory: z.string().describe('Product category, e.g. "Smartphones".'),
  condition: z.enum(['new', 'used', 'defective']).describe('Visible condition of the item.'),
  keyAttributes: z.array(z.string()).describe('Brand, model, color and other distinguishing attributes.'),
});

export type VisionInspectorInput = z.infer<typeof visionInspectorInputSchema>;
export type VisionInspectorOutput = z.infer<typeof visionInspectorOutputSchema>;

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

const PROMPT =
  'You inspect a photo of a single item that will be sold second-hand. ' +
  'Describe the item as JSON that matches the response schema.';

export async function inspectImage(input: VisionInspectorInput): Promise<VisionInspectorOutput> {
  const mimeType = input.mimeType ?? MIME_TYPE_BY_EXTENSION[extname(input.imagePath).toLowerCase()];
  if (!mimeType) {
    throw new Error(`Cannot infer the MIME type of "${input.imagePath}". Pass mimeType explicitly.`);
  }

  const imagePart = input.imagePath.startsWith('gs://')
    ? createPartFromUri(input.imagePath, mimeType)
    : createPartFromBase64((await readFile(input.imagePath)).toString('base64'), mimeType);

  // Gemini accepts JSON Schema keywords but not the "$schema" dialect marker.
  const { $schema: _dialect, ...responseJsonSchema } = z.toJSONSchema(visionInspectorOutputSchema);

  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: createUserContent([imagePart, PROMPT]),
    config: { responseMimeType: 'application/json', responseJsonSchema },
  });
  if (!response.text) {
    throw new Error('Gemini returned no text for the image.');
  }
  return visionInspectorOutputSchema.parse(JSON.parse(response.text));
}

export const visionInspectorTool = new FunctionTool({
  name: 'vision_inspector',
  description:
    'Analyzes a photo of an item and returns a suggested title, category, condition and key attributes.',
  parameters: visionInspectorInputSchema,
  execute: inspectImage,
});
```

- [ ] **Step 4: Replace `src/tools/price-evaluator.ts` with the reference implementation**

```ts
import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { GEMINI_MODEL, getGenAI } from '../config.js';

export const priceEvaluatorInputSchema = z.object({
  itemQuery: z.string().describe('Search terms for the item, e.g. "Logitech MX Keys keyboard black".'),
  condition: z.enum(['new', 'used', 'defective']).describe('Condition of the item being sold.'),
});

export const priceEvaluatorOutputSchema = z.object({
  priceMin: z.number().nonnegative().describe('Lower end of the realistic used price range.'),
  priceMax: z.number().nonnegative().describe('Upper end of the realistic used price range.'),
  recommendedPrice: z.number().nonnegative().describe('Price to list the item at.'),
  currency: z.string().describe('ISO 4217 currency code, e.g. "EUR".'),
});

export type PriceEvaluatorInput = z.infer<typeof priceEvaluatorInputSchema>;
export type PriceEvaluatorOutput = z.infer<typeof priceEvaluatorOutputSchema>;

export async function evaluatePrice(input: PriceEvaluatorInput): Promise<PriceEvaluatorOutput> {
  const prompt =
    `Search for current second-hand listings in Germany for: ${input.itemQuery} (condition: ${input.condition}). ` +
    'Answer with one JSON object and nothing else, using the keys ' +
    'priceMin, priceMax, recommendedPrice (numbers) and currency (ISO 4217 code).';

  // Search grounding cannot be combined with a response schema on every model,
  // so the JSON is requested in the prompt and validated with Zod afterwards.
  const response = await getGenAI().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const json = response.text?.match(/\{[\s\S]*\}/)?.[0];
  if (!json) {
    throw new Error('Gemini returned no JSON price estimate.');
  }
  return priceEvaluatorOutputSchema.parse(JSON.parse(json));
}

export const priceEvaluatorTool = new FunctionTool({
  name: 'price_evaluator',
  description: 'Researches a realistic second-hand price range for an item in a given condition.',
  parameters: priceEvaluatorInputSchema,
  execute: evaluatePrice,
});
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/tools/vision-inspector.ts src/tools/price-evaluator.ts
git commit -m "Chapter 1 solution: implement vision inspector and price evaluator"
```

- [ ] **Step 7: Verify the full chain and the shape of the chapter diff**

Run: `scripts/verify-chain.sh; echo "exit=$?"`
Expected:
```
ok   [chapter-01-starter]
ok   [chapter-01-solution]
OK: chain verified (main chapter-01-starter chapter-01-solution)
exit=0
```

Run: `git diff --name-only chapter-01-starter chapter-01-solution`
Expected, exactly:
```
src/tools/price-evaluator.ts
src/tools/vision-inspector.ts
```

- [ ] **Step 8: Run the skill on the solution**

Dispatch a fresh subagent (or do it yourself when executing inline) with this prompt, replacing `<worktree>` with the absolute path of the chain worktree:

> You are testing a Claude Code skill. Working directory: `<worktree>`. A learner asks: "Is my chapter done?" Read `.claude/skills/check-chapter/SKILL.md` and follow it exactly. If the skill tells you to ask the learner about the live test, assume the answer is "no". Do not modify any file. Return the report exactly as you would show it to the learner, then list every command you ran.

Expected:
- Verdict line: `Chapter 01: met with unverified items` (not plain `met`).
- `ch01-1` to `ch01-6` and `ch01-tc` are `[met]`.
- `ch01-live-1` and `ch01-live-2` are `[unverified]`.
- No command the subagent ran used `git show`, `git diff`, `git log -p`, or `git grep` against a `chapter-01-solution` ref.

If a result differs, fix the corresponding instruction on `main`, replay the chain (`git switch chapter-01-solution && git rebase --update-refs main`), and run Steps 7 and 8 again.

- [ ] **Step 9 (optional, needs the user): live run**

The spec does not require the solution to run. Ask the user whether to try it with their API key and a photo. Only if they agree and provide a photo path:

```bash
cp <primary-checkout>/.env .env
npm run test:tools -- <path-to-photo>
rm .env
```

Expected: a `VisionInspectorTool result:` object and a `PriceEvaluatorTool result:` object with numeric prices. If the model ID in `src/config.ts` is rejected, report the error to the user; the fix belongs on `chapter-01-starter`.

---

### Task 5: Release `v1`

**Files:** none (refs only).

**Interfaces:**
- Consumes: branches `chapter-01-starter` and `chapter-01-solution`; `scripts/verify-chain.sh`.
- Produces: tags `chapter-01-starter-v1`, `chapter-01-solution-v1`.

- [ ] **Step 1: Confirm a clean, verified chain**

Run: `git status --short && scripts/verify-chain.sh`
Expected: no status output, then `OK: chain verified (main chapter-01-starter chapter-01-solution)`.

- [ ] **Step 2: Rehearse the maintainer flow in a throwaway clone**

```bash
rehearsal=$(mktemp -d)
git clone --quiet . "$rehearsal"
(
  cd "$rehearsal"
  git switch --quiet chapter-01-starter
  git switch --quiet chapter-01-solution
  git switch --quiet main
  before=$(git rev-parse chapter-01-starter)
  echo "rehearsal fix" >> README.md
  git commit --quiet -am "Rehearsal: fix on main"
  git switch --quiet chapter-01-solution
  git rebase --quiet --update-refs main
  [ "$(git rev-parse chapter-01-starter)" != "$before" ] &&
    git merge-base --is-ancestor main chapter-01-starter &&
    git merge-base --is-ancestor chapter-01-starter chapter-01-solution &&
    [ "$(git diff --name-only chapter-01-starter chapter-01-solution | wc -l | tr -d ' ')" = 2 ] &&
    echo "REBASE_OK"
)
rm -rf "$rehearsal"
```

Expected: `REBASE_OK`. If it is missing, the README's maintainer flow is wrong: correct it on `main`, replay the chain, and repeat from Step 1.

- [ ] **Step 3: Tag the release**

```bash
git tag -a chapter-01-starter-v1 chapter-01-starter -m "Chapter 1 starter, release v1"
git tag -a chapter-01-solution-v1 chapter-01-solution -m "Chapter 1 solution, release v1"
git tag --list 'chapter-*'
```

Expected:
```
chapter-01-solution-v1
chapter-01-starter-v1
```

- [ ] **Step 4: Confirm the skill names the tag on `main`**

```bash
git switch main
```

Dispatch a fresh subagent (or do it yourself when executing inline) with this prompt, replacing `<worktree>` with the absolute path of the chain worktree:

> You are testing a Claude Code skill. Working directory: `<worktree>`. A learner asks: "Is my chapter done?" Read `.claude/skills/check-chapter/SKILL.md` and follow it exactly. If the skill tells you to ask the learner about the live test, assume the answer is "no". Do not modify any file. Return the report exactly as you would show it to the learner, then list every command you ran.

Expected: the report says the learner is not on a chapter branch and tells them to run `git switch -c my-chapter-01 chapter-01-starter-v1`.

- [ ] **Step 5: Walk the spec's acceptance criteria**

| # | Criterion | Evidence |
|---|---|---|
| 1 | `verify-chain.sh` passes | Step 1 |
| 2 | Skill on starter: `ch01-1`…`ch01-6` unmet, `ch01-tc` met | Task 3, Step 12 |
| 3 | Skill on solution: `ch01-1`…`ch01-6` and `ch01-tc` met | Task 4, Step 8 |
| 4 | Skill on `main` names `chapter-01-starter-v1` | Step 4 |
| 5 | Both `v1` tags exist | Step 3 |
| 6 | Chapter diff touches only the two tool files | Task 4, Step 7 |

Report each row with the actual output observed. Any row without evidence is not done.

- [ ] **Step 6: Hand over; do not push**

Report to the user: the three branches and two tags exist locally in the chain worktree's repository. Ask whether to push. Only after an explicit yes:

```bash
git push origin main chapter-01-starter chapter-01-solution
git push origin chapter-01-starter-v1 chapter-01-solution-v1
```

Also tell the user that `spec/tutorial-git-concept` is now fully contained in `main` and can be deleted, and that their staged `specs/de/*` entries in the primary checkout were left untouched.
