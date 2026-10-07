# Tutorial Git Concept, Validation Skill, and Chapter 1

Date: 2026-10-07
Status: awaiting review

## Purpose

The ADK TypeScript tutorial builds one Kleinanzeigen listing agent across four
chapters. The repository should feel like a real project that grows over time:
all code lives in the repository root, and chapters are positions in Git
history rather than `chapter-XX/` folders.

This spec defines:

1. the branch and tag scheme that carries the chapters,
2. a Claude Code skill that tells a learner whether their current work meets
   the chapter goal, and
3. the chapter 1 starter and solution, built as the first proof of the scheme.

Source of truth for chapter content:
[`docs/specs/tutorial_content.md`](../../specs/tutorial_content.md).

## Scope

In scope:

- Shared base on `main` (README, skill, chain verification script).
- Branches `chapter-01-starter` and `chapter-01-solution`, tagged `v1`.
- The `check-chapter` skill with criteria for chapter 1.

Out of scope:

- Chapters 2 to 4. Each gets its own spec and plan and adds its own criteria
  file and branch pair.
- Tests for the reference solutions. Solutions are reference material and need
  not run.
- Changes to the `adk-web` submodule.

## Decisions

| Topic | Decision |
|---|---|
| Refs per chapter | Mutable branches plus immutable release tags |
| Layout | Linear rebased stack; skill and criteria live in the repo on `main` |
| Learner progression | Fresh checkout of the next starter; own code is not carried forward |
| Skill hints | Diagnose and point: name the gap, the file, the TODO, a docs link. Never show solution code |
| Skill execution | Static reading and `tsc --noEmit` run freely; the live test script runs only after the learner confirms |
| Solutions | Must typecheck; need not run |
| Project setup | Provided by the starter, not a learner task |

## Branch and tag model

```
main ── chapter-01-starter ── chapter-01-solution ── chapter-02-starter ── …
```

- `main` holds only what every chapter shares: README, `docs/specs/`, the skill,
  `scripts/verify-chain.sh`, `.env.example`, and the bare `package.json` and
  `tsconfig.json`. It contains no chapter code.
- `chapter-NN-starter` is the previous solution (or `main` for chapter 1) plus
  commits that add type signatures, stubs, `// TODO(chNN-k)` blocks with task
  descriptions, new dependencies, and the chapter marker file.
- `chapter-NN-solution` is its starter plus commits that fill in the TODOs.
- Implementation plans quote the reference solution, so they stay on
  maintainer branches and are not part of the chain.

### Tags

Tags are named `chapter-NN-starter-vK` and `chapter-NN-solution-vK`. A release
cuts the same `vK` on every chapter branch that exists at that moment. Tags are
never moved or deleted. Tutorial text links to tags; a branch name means
"latest".

### TODO markers

Every learner task is marked in code as:

```ts
// TODO(ch01-2): Define the output schema. It must describe title,
// detectedCategory, condition, and keyAttributes.
```

The ID (`ch01-2`) is the key shared by the code, the criteria file, and the
skill's report.

### Chapter marker

Each starter commits `.tutorial/chapter` containing the two-digit chapter
number (`01`). The skill reads this file, so it works on a learner's own work
branch whatever that branch is called. `main` has no marker.

### Invariants

`scripts/verify-chain.sh` on `main` holds the ordered list of chain branches
and checks:

1. Each branch is an ancestor of the next (`git merge-base --is-ancestor`).
2. Every starter passes `tsc --noEmit`.
3. Every solution passes `tsc --noEmit` and contains no `TODO(chNN-` marker for
   its own chapter.
4. Every starter and solution has a `.tutorial/chapter` matching its name.

Each branch is checked in a temporary worktree with its own dependency
install, so the working tree is left untouched. The script exits non-zero on
the first violated invariant and names the branch and the invariant.

### Learner flow

```sh
git switch -c my-chapter-01 chapter-01-starter-v1
# work on the TODOs, run the check-chapter skill
git switch -c my-chapter-02 chapter-02-starter-v1
```

### Maintainer flow for a fix

1. Commit the fix on the earliest branch it belongs to (`main` for shared
   material).
2. Check out the tip of the chain and run
   `git rebase --update-refs <fixed-branch>`.
3. Run `scripts/verify-chain.sh`.
4. Cut `v(K+1)` tags on every chain branch.
5. Push branches with `--force-with-lease` and push the new tags.

The README documents both flows.

## The `check-chapter` skill

### Layout

```
.claude/skills/check-chapter/
  SKILL.md                  procedure and reporting rules
  chapters/chapter-01.md    criteria for chapter 1
```

The skill lives on `main`, so every chapter branch inherits it.

### Criteria file

A criteria file is the checkable form of a chapter's "Goals" and "Validation"
sections. Each criterion has:

- **ID**: matches a `TODO(chNN-k)` where one exists.
- **Target**: file and export concerned.
- **Requirement**: what must be true, in plain words.
- **Check type**: `static`, `typecheck`, or `live`.
- **Hint**: one sentence pointing at the concept, plus a docs link.

### Procedure

1. Read `.tutorial/chapter`. If it is missing, tell the learner they are not
   on a chapter branch and name the starter tag to check out. Stop.
2. Load `chapters/chapter-NN.md`. If it is missing, say that the chapter has
   no criteria yet. Stop.
3. Check each `static` criterion by reading the working tree.
4. Run `npx tsc --noEmit` for the `typecheck` criterion.
5. If there are `live` criteria, ask the learner whether to run the chapter's
   test command. If they decline, or the required API key is not set, mark
   those criteria **unverified**.
6. Report.

### Report

- Overall verdict: **met**, **not yet met**, or **met with unverified items**.
- One line per criterion with its status.
- For each unmet criterion: the file, the TODO ID, what is missing, and the
  docs link.
- When any criterion is unverified: the reason and the command to verify it.
- A closing line with the command to view the reference solution, using the
  newest release tags: `git diff chapter-NN-starter-vK chapter-NN-solution-vK`.

### Hard rules

The skill never edits the learner's code, never reads any
`chapter-NN-solution` ref, and never prints solution code.

## Chapter 1

### Shared base added to `main`

- `README.md`: what the tutorial is, learner flow, maintainer flow.
- `.env.example`: `GEMINI_API_KEY=`.
- `scripts/verify-chain.sh`.
- `.claude/skills/check-chapter/` as described above.

### `chapter-01-starter`

| File | State |
|---|---|
| `package.json` | Provided. `"type": "module"`; adds `zod`, `@google/genai`, `dotenv`, `tsx`; scripts `typecheck` (`tsc --noEmit`) and `test:tools` (`tsx scripts/test-tools.ts`) |
| `tsconfig.json` | Provided. ESM (`module` and `moduleResolution` `nodenext`), includes `src` and `scripts` |
| `src/config.ts` | Provided. Loads `dotenv`; exports the Gemini model ID as a single constant |
| `src/tools/vision-inspector.ts` | `TODO(ch01-1)`, `TODO(ch01-2)`, `TODO(ch01-3)` |
| `src/tools/price-evaluator.ts` | `TODO(ch01-4)`, `TODO(ch01-5)`, `TODO(ch01-6)` |
| `scripts/test-tools.ts` | Provided. Takes an image path as its argument, runs both tools, and validates each result with the tool's own Zod output schema |
| `.tutorial/chapter` | `01` |

Each tool file exports its input schema, its output schema, and a
`FunctionTool` from `@google/adk`. In the starter the schemas are
`z.object({})` and `execute` throws `not implemented`, so the starter
typechecks. The test script only parses and prints results; it does not access
individual fields, so it compiles against the empty starter schemas.

No test image is committed. The learner passes the path to their own photo.

### Chapter 1 criteria

| ID | Type | Requirement |
|---|---|---|
| `ch01-1` | static | Vision input schema has `imagePath` (local path or GCS URI) and an optional `mimeType` |
| `ch01-2` | static | Vision output schema has `title`, `detectedCategory`, `condition` (new, used, defective), and `keyAttributes` (array of strings) |
| `ch01-3` | static | Vision `execute` sends the image to Gemini and returns a value parsed with the output schema |
| `ch01-4` | static | Price input schema has `itemQuery` and `condition` |
| `ch01-5` | static | Price output schema has numeric `priceMin`, `priceMax`, `recommendedPrice`, and a `currency` |
| `ch01-6` | static | Price `execute` researches a used-price range and returns a value parsed with the output schema |
| `ch01-tc` | typecheck | `tsc --noEmit` reports no errors |
| `ch01-live-1` | live | `test-tools.ts` gets a schema-valid vision result for the test image |
| `ch01-live-2` | live | `test-tools.ts` gets a numeric price range for the detected item |

A `static` criterion is unmet while its `TODO` marker is still present or the
requirement is not satisfied by the code.

### `chapter-01-solution`

Fills in all six TODOs:

- The vision tool reads the image, sends it to Gemini with a structured-output
  schema, and parses the response with the Zod output schema.
- The price tool asks Gemini, with Google Search grounding, for a realistic
  used-price range for the item and condition, and parses the answer with the
  Zod output schema.

The tutorial content names "Gemini 1.5 Pro / Flash", which is outdated. The
model ID lives only in `src/config.ts` and is set to a current Flash model.

## Acceptance criteria

1. `scripts/verify-chain.sh` passes for `main`, `chapter-01-starter`, and
   `chapter-01-solution`.
2. Run on `chapter-01-starter`, the skill reports `ch01-1` to `ch01-6` unmet
   and `ch01-tc` met.
3. Run on `chapter-01-solution`, the skill reports `ch01-1` to `ch01-6` and
   `ch01-tc` met.
4. Run on `main`, the skill reports that no chapter is checked out and names
   `chapter-01-starter-v1`.
5. Tags `chapter-01-starter-v1` and `chapter-01-solution-v1` exist.
6. `git diff chapter-01-starter chapter-01-solution` touches only the two tool
   files.
