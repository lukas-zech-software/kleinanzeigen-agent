# How this was built

I built this tutorial with coding agents, mostly Claude Code with the
Superpowers skills for brainstorming, planning, and review. This page describes
the method, because the method is the part I would reuse.

My rule for AI-assisted work is simple: generated code and text meet the same
standards as everything else I ship. The larger changes in this repository
were specified before they were written, and reviewed and verified after.

## The workflow

### 1. An idea, written down

The project started as a short prompt: a tutorial that lives in the repository
root like a real project, with chapters as Git branches, a starter and a
solution for each, and a skill that checks a learner's work.

### 2. A design spec

Before any tutorial code was written, the idea went through a structured brainstorming
session with the agent: one question at a time, alternatives with trade-offs,
then a written design that I reviewed.

- [Git concept, validation skill, and chapter 1](superpowers/specs/2026-10-07-tutorial-git-concept-design.md)
- [Public release](superpowers/specs/2026-10-10-public-release-design.md)
- [ADK-only foundation and chapter 1](superpowers/specs/2026-10-13-adk-only-foundation-chapter-01-design.md)

The specs record decisions and what was left out on purpose. The second one,
for example, records the decision that chapter 3 stops before posting a
listing and hands over to a person. The [roadmap](roadmap.md) explains why.

### 3. An implementation plan

Each spec becomes a plan of small tasks with exact file contents, the commands
that verify them, and the expected output.

The plans stay on a maintainer branch and out of the learner's way. The plan
for chapter 1, for example, quotes the reference solution.

### 4. A chain of branches that is verified

Chapters are branches, and each starter is built on the previous chapter's
solution. A fix on an early branch is replayed through the rest with
`git rebase --update-refs`.

A chain like that breaks easily, so
[`scripts/verify-chain.sh`](../scripts/verify-chain.sh) checks its invariants:
each branch is an ancestor of the next, every chapter branch typechecks, a
solution has no open TODO, and everything is formatted. The script runs
[in CI](../.github/workflows/verify-chain.yml) on every push and once a week.

### 5. An agent that tutors

Two files turn a coding agent into a tutor for the learner:

- [`AGENTS.md`](../AGENTS.md) tells any agent how to behave in this
  repository: explain the concept, point at the TODO, review what the learner
  wrote, and never read the solution branch.
- The [`check-chapter` skill](../.claude/skills/check-chapter/SKILL.md) checks
  the learner's working tree against the
  [criteria of the chapter](../.claude/skills/check-chapter/chapters/chapter-01.md)
  and reports which goals are open, with a hint and a documentation link for
  each. It does not show solution code.

## What I took from it

- Writing the spec first is where most of the thinking happens. The plans and
  the code that follow are much less surprising.
- An agent needs the same things a new colleague needs: context, clear rules,
  and a way to check its own work. `AGENTS.md` and the verification script are
  that.
- A check that a script can run beats a rule that someone has to remember.
- Probe before you specify. A feature that is documented for another
  language, or that only exists as an option in a type definition, is not a
  feature until it has run here.
  [ADR 0001](adr/0001-model-access-through-adk.md) records what that cost.
