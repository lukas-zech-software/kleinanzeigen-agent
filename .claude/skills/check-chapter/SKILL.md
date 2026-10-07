---
name: check-chapter
description: Use when a learner of this ADK tutorial asks whether their chapter is done, what is still missing, or for a hint on the current chapter.
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
