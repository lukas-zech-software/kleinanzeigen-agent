# Instructions for coding agents

This repository is a tutorial. The person you are working with is learning the
Agent Development Kit (ADK) for TypeScript by building a Kleinanzeigen listing
agent, one chapter at a time. Chapters are Git branches, not folders;
[README.md](README.md) explains the layout.

## Find out where the learner is

- `.tutorial/chapter` holds the two-digit number of the chapter they are on.
  When the file is missing they are not on a chapter branch: point them to
  "Working through a chapter" in the README.
- `CURRENT_CHAPTER.md` describes that chapter: prerequisites, goal, tasks, and
  how to validate them.
- Open tasks are marked in the code as `// TODO(chNN-k)`. A task is done when
  its requirement holds and its TODO comment is deleted.

## Help them learn

- The TODO blocks are the learner's work. Explain the concept, name the file
  and the TODO, link the docs, and review what they wrote. Write the
  implementation of a TODO only when the learner explicitly asks you to.
- Assume the learner is new to ADK. Explain a term the first time you use it
  and keep answers short.
- Never read a `chapter-NN-solution` branch or tag, whatever the Git command.
  When the learner wants the reference solution, give them the command to run:
  `git diff chapter-NN-starter-vK chapter-NN-solution-vK`.
- Never print the value of an API key. `.env` stays out of Git.
- Leave the tutorial's own files as they are: `README.md`, `AGENTS.md`,
  `CURRENT_CHAPTER.md`, `.tutorial/`, `.claude/skills/`, and
  `scripts/verify-chain.sh`.

## Commands

```sh
npm ci                                    # install dependencies
npm run typecheck                         # tsc --noEmit
npm run test:tools -- path/to/photo.jpg   # live test of the chapter 1 tools
npm run format                            # format every file with Prettier
```

`test:tools` calls the Gemini API and uses the learner's quota. Ask before you
run it.

## Checking a chapter: the `check-chapter` skill

Use the skill when the learner asks whether their chapter is done, what is
still missing, or for a hint.

- Claude Code loads it from `.claude/skills/check-chapter/` and runs it on a
  question such as "is my chapter done?".
- Any other agent: read `.claude/skills/check-chapter/SKILL.md` and follow its
  procedure and its hard rules. The criteria for chapter NN are in
  `chapters/chapter-NN.md` next to it.

The skill reports which goals are open and where to look. It does not show
solution code, and neither should you while it runs.

## Code style

Prettier decides the formatting (`.prettierrc.json`). Run `npm run format`
after you edit files, and do not reformat by hand. The project is ESM
TypeScript in strict mode: relative imports end in `.js`.
