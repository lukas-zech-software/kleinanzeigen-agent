# Public release: README, repository hygiene, and GitHub settings

Date: 2026-10-10
Status: approved 2026-10-10

## Purpose

The repository goes public on GitHub. Its landing page has to work for three
readers:

- a visitor who spends 30 seconds on it,
- an engineer who spends a few minutes judging the quality of the work,
- a developer who wants to learn the Agent Development Kit (ADK) with it.

It should show technical skill, deliberate use of AI tooling, the habit of
learning in public, and a mentoring mindset.

## Decisions

| Topic                | Decision                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Timing               | Publish now with chapter 1. Chapters 2 to 4 appear as planned in a roadmap.                                       |
| Chapter 3            | Human-in-the-loop handoff. The agent prepares and validates a listing; a person posts it. No browser automation. |
| README audience      | Two-path opening: "here to learn" and "here to see how it's built". The README stays a tutorial page.           |
| AI process           | A curated "How this was built" page. The raw idea prompt leaves `main`.                                          |
| License              | MIT for the author's code and text. The example photos keep their public-domain and CC0 terms, and the vendored `gemini-api-dev` skill stays under Apache 2.0. |
| Author section       | Summary taken from the GitHub profile README, with a link to the profile.                                        |
| Agent rules          | The learner-facing rules in `AGENTS.md` do not bind maintainer sessions. `AGENTS.md` itself stays unchanged.     |

## Out of scope

- Writing chapters 2 to 4.
- Renaming the repository.
- A code of conduct and issue templates. Discussions and plain issues are
  enough for a single-maintainer tutorial.
- A documentation site.
- Producing a social preview image.

## Files on `main`

| File                                       | Change                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `README.md`                                | Rewritten, see "README" below.                                                             |
| `CONTRIBUTING.md`                          | New. Holds "Maintaining the chain" from the README, plus how to report problems.           |
| `docs/roadmap.md`                          | New. Replaces `docs/specs/tutorial_content.md`.                                            |
| `docs/how-this-was-built.md`               | New.                                                                                       |
| `LICENSE`                                  | New. MIT, `Copyright (c) 2026 Lukas Zech`.                                                 |
| `SECURITY.md`                              | New. Reports go through GitHub private vulnerability reporting. No hosted service exists.  |
| `.github/workflows/verify-chain.yml`       | New, see "CI".                                                                             |
| `.nvmrc`                                   | New, contains `26`.                                                                        |
| `docs/specs/tutorial_content.md`           | Removed, superseded by `docs/roadmap.md`.                                                  |
| `docs/specs/tutorial_idea_git_concept.md`  | Removed from `main`. It stays on the `spec/tutorial-git-concept` branch.                   |
| `docs/superpowers/specs/2026-10-07-tutorial-git-concept-design.md` | Two path references updated to `docs/roadmap.md`.                                          |
| `CURRENT_CHAPTER.md`                       | Tag number updated to the new release.                                                     |
| `package.json`                             | See "Repository hygiene".                                                                  |
| `.gitignore`, `.prettierignore`, `.idea/`  | See "Repository hygiene".                                                                  |
| `.gitmodules`, `adk-web`                   | Removed.                                                                                   |

## README

Sections, in order:

1. **Title, tagline, badges.** Badges: chain verification workflow, license,
   Node version.
2. **Intro.** Three to five sentences: what the tutorial builds, that it is the
   author's way of learning ADK in public, and a status line: "Chapter 1 of 4
   is available. See the roadmap."
3. **Two paths.** "Here to learn" links to Quick start. "Here to see how it's
   built" links to the guided tour.
4. **What you build.** A Mermaid flowchart of the pipeline: photo → vision
   inspector → price evaluator → listing draft (Markdown with YAML
   frontmatter) → human approves → validated, ready-to-post package → human
   posts. Below it a roadmap table with one row per chapter, the ADK concept it
   teaches, and its status (available or planned). It links to
   `docs/roadmap.md`.
5. **Quick start.**
   - Prerequisites: Node.js 26 or newer, Git, a Google AI Studio API key with
     a link to where to create one, and a note that the live test uses the
     learner's Gemini quota.
   - Commands: `git clone`, `git switch -c my-chapter-01 <newest starter tag>`,
     `npm ci`, `cp .env.example .env`.
   - The two check commands, what the unfinished starter prints (a "not
     implemented" error), and a sample of the output a finished chapter
     prints. The sample comes from one real run of the reference solution, made with
     the maintainer's approval because it uses their quota.
6. **How a chapter works.** `CURRENT_CHAPTER.md`, the `TODO(chNN-k)` markers,
   asking a coding agent "is my chapter done?", viewing the reference solution
   with `git diff`, and starting the next chapter from its starter tag.
7. **Guided tour.** Five links, each with one sentence on what to notice:
   - the chapter branch chain and `scripts/verify-chain.sh`,
   - the `check-chapter` skill, which reviews a learner's work without
     revealing the solution,
   - `AGENTS.md`, which tells any coding agent how to act as a tutor,
   - the CI workflow that verifies every branch,
   - `docs/how-this-was-built.md` and the design specs.
8. **Questions and feedback.** GitHub Discussions for questions, issues for
   errors in the tutorial, and a link to `CONTRIBUTING.md`.
9. **About the author.** Text below.
10. **License and disclaimer.** MIT. The project is not affiliated with or
    endorsed by Kleinanzeigen or its operator, the name only describes the kind
    of listing the agent prepares, and the tutorial does not automate posting.

"Maintaining the chain" moves to `CONTRIBUTING.md` unchanged, with one added
release step: update the tag numbers in `README.md` and in `main`'s
`CURRENT_CHAPTER.md` before replaying the chain.

### About the author

```markdown
## About the author

I'm Lukas Zech, a Senior Staff/Principal Software Engineer from Augsburg. I've
been building software professionally since 2010, across freelance projects,
startups (including my own) and engineering teams, mostly in TypeScript and
across the whole stack.

- Sharing knowledge, mentoring and a good developer experience are part of how
  I work. Software development is a team sport.
- I'm exploring how coding agents can make everyday engineering better. My
  rule: AI-generated code meets the same standards as everything else we ship.
- This tutorial is how I'm teaching myself ADK. I publish it so others can
  learn along with me.

Want to know more about me? [Visit my GitHub profile](https://github.com/lukas-zech-software).
```

## `docs/roadmap.md`

One section per chapter with the same four parts the outline has today:
prerequisites, goal, what is implemented, and validation.

- **Chapter 1, tools.** Unchanged in substance. The model is described as "the
  current Gemini Flash model set in `src/config.ts`" and the documentation
  links match `CURRENT_CHAPTER.md`.
- **Chapter 2, listing agent and human review.** Unchanged in substance.
- **Chapter 3, publisher agent and human handoff.** Rewritten. A second agent
  reads an approved draft, refuses to act while `status: draft`, validates the
  listing (title at most 65 characters, price, category, images present), and
  writes a ready-to-post package. A person posts it. Playwright,
  `playwright-stealth`, stored session cookies, and the `kleinanzeigen-bot`
  CLI are gone. Validation: the agent calls no tool for a draft, and produces a
  valid package for an approved listing.
- **Chapter 4, Cloud Run and Eventarc.** Updated to match chapter 3: the
  publisher service produces the package, so the container needs no Chromium.

The page states that chapters 2 to 4 are planned and may change.

## `docs/how-this-was-built.md`

A short account of the workflow, written for an engineer:

1. An idea, written down as a prompt.
2. A brainstormed design spec, linked: the 2026-10-07 spec and this one.
3. An implementation plan, kept off the chain because it quotes the reference
   solutions.
4. A chain of branches where each starter builds on the previous solution,
   kept consistent by `scripts/verify-chain.sh` and CI.
5. A skill and `AGENTS.md` that turn a coding agent into a tutor that gives
   hints and withholds solutions.

It names the tools used (Claude Code and its skills) and states the working
rule: every generated change is reviewed and verified like hand-written code.

## Repository hygiene

- Remove the `adk-web` submodule, `.gitmodules`, and the `adk-web` entries in
  `.prettierignore`, `.idea/vcs.xml`, and `.idea/kleinanzeigen-agent.iml`. The
  rest of `.idea/` stays: the shared IDE settings are intentional.
- `.gitignore`: split the broken line `.vscode/*### JetBrains template` into
  two, and add `.claude/settings.local.json`.
- `.prettierignore`: add `.claude/settings.local.json`.
- `package.json`: add `description`, `license` (`MIT`), `author`, `repository`,
  and `engines.node` (`>=26`). Remove `main` and the `run` script, which point
  at an `agent.ts` that no branch has. Chapter 2 adds them back when the agent
  exists.

## CI

`.github/workflows/verify-chain.yml`:

- Triggers: push to `main` and `chapter-**`, manual dispatch, and a weekly
  schedule that catches changes in the Node.js 26 line and the runner image.
  Dependencies are installed from the lockfile, so a new upstream release
  does not reach the check.
- Steps: check out with full history, create a local branch for `main` and
  every `origin/chapter-*` branch (the script checks `refs/heads/…`), set up
  Node 26, run `scripts/verify-chain.sh`.
- A concurrency group per branch cancels a superseded run of the same branch.
- `scripts/verify-chain.sh` is not changed.

## GitHub settings

Rulesets and the security features below are available on a free personal
account only once the repository is public.

Before going public:

- Description: "Hands-on tutorial: build an AI agent with Google's Agent
  Development Kit (ADK) for TypeScript, one chapter at a time."
- Topics: `adk`, `agent-development-kit`, `gemini`, `gemini-api`, `ai-agents`,
  `agentic-workflows`, `typescript`, `tutorial`, `zod`.
- Enable Discussions.

After going public:

- Secret scanning with push protection.
- Dependabot alerts and security updates.
- Private vulnerability reporting.
- CodeQL default setup.
- Tag ruleset on `chapter-*-v*`: block updates and deletions.
- Branch ruleset on `main`: block force pushes and deletion. The chapter
  branches stay force-pushable, because the chain is rebased by design.

Manual steps for the maintainer:

- Change the visibility to public.
- Upload a social preview image.
- Pin the repository on the profile.

## Rollout

1. Commit the changes on `main`, in the `kleinanzeigen-agent-chain` worktree,
   as a few focused commits.
2. Replay the chain: `git rebase --update-refs main` from
   `chapter-01-solution`. `package.json` is expected to conflict, because the
   starter also edits it. Both sides are kept.
3. Run `scripts/verify-chain.sh`.
4. Tag `chapter-01-starter-v3` and `chapter-01-solution-v3`.
5. Push the three branches with `--force-with-lease`, then the tags.
6. Apply the pre-public settings.
7. The maintainer changes the visibility to public.
8. Apply the post-public settings.

A pattern scan of every ref for API keys, private keys, and tokens found
nothing on 2026-10-10. Push protection covers later pushes.

Each step that changes GitHub or pushes is confirmed with the maintainer
before it runs.

## Verification

- `scripts/verify-chain.sh` passes locally and in CI.
- `npm run format:check` passes on every chain branch.
- The README is checked rendered on GitHub while the repository is still
  private: the Mermaid diagram draws, the badges resolve, and every link
  works.
- The Quick start is followed from a fresh clone. The live API call is made
  only with the maintainer's approval, because it uses their quota.
- After going public, the repository page shows the license, description,
  topics, and a passing workflow badge.
