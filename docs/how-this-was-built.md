# How this was built

> **In short:** I built this tutorial with a team of AI coding agents and ran
> it like an engineering team. One model did the design work and the hard
> problems. Other agents took the routine jobs in parallel. Every line they
> produced had to pass the same specs, reviews, and automated checks as code I
> write by hand.

This page describes the setup and the method, because the method is the part I
would bring to any team.

## At a glance

| What                        | Detail                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| **Lead agent**              | Claude Code with Claude Opus 5.5: concepts, design specs, the hard work |
| **Supporting agents**       | Codex, OpenCode, and Antigravity CLI: clean-ups, `npm audit`, test runs |
| **Workspace**               | JetBrains WebStorm with its new Air module for managing agent sessions  |
| **Agents at the same time** | Up to three, each in its own Git worktree or on a separate project      |
| **Longest autonomous run**  | **More than 7 hours**, one Claude agent, not a single question to me    |
| **Cost of that run**        | About $120 at API prices, covered by my subscription                    |
| **Design specs**            | Six, each reviewed by me before any code was written                    |

## The agent team

I did not work with one assistant. I worked with a roster of agents, managed
side by side in JetBrains WebStorm and its new Air module for agent sessions.
Codex, OpenCode, and Antigravity CLI connect to the IDE through the
[Agent Client Protocol](https://agentclientprotocol.com/) (ACP). Claude Code
does not support ACP, so it ran in its own harness, right next to them.

Each agent got the work it is best at:

- **Claude Code with Opus 5.5 is the architect.** It did the concept work:
  brainstorming, design specs, implementation plans, and the difficult parts
  of the implementation and the debugging.
- **Codex, OpenCode, and Antigravity CLI are the crew.** They took the jobs
  that are heavy on syntax but more or less deterministic: running `npm audit`,
  executing the tests, formatting, and cleaning up.

The most capable model spends its time where judgment matters, and the routine
work runs alongside it instead of blocking it.

## Long autonomous runs

For long tasks that could not be fully specified up front, I experimented with
Claude Code's goal mode: the agent gets a goal instead of a list of steps and
keeps working until the goal is met.

**The highlight: one Claude agent worked continuously for more than seven
hours without stopping once to ask me a question.** At API prices that run
would have cost about $120; it ran on my subscription.

A run like that is only worth starting when the agent can tell for itself
whether it is on track. The workflow below provides exactly that: a reviewed
spec that says what done means, rules in [`AGENTS.md`](../AGENTS.md), and a
[verification script](../scripts/verify-chain.sh) that checks the result.

## Agents in parallel

Up to three agents worked at the same time. Each had its own
[Git worktree](https://git-scm.com/docs/git-worktree), a second checkout of
the same repository on a different branch, or worked on a separate project.
No two agents edited the same files, so no agent could break another one's
work, and I reviewed each result on its own branch.

## The workflow

### 1. An idea, written down

The project started as a short prompt: a tutorial that lives in the repository
root like a real project, with chapters as Git branches, a starter and a
solution for each, and a skill that checks a learner's work.

### 2. A design spec

Before any tutorial code was written, the idea went through a structured
brainstorming session with the agent, using the
[Superpowers](https://github.com/obra/superpowers) skills: one question at a
time, alternatives with trade-offs, then a written design that I reviewed.

- [Git concept, validation skill, and chapter 1](superpowers/specs/2026-10-07-tutorial-git-concept-design.md)
- [Public release](superpowers/specs/2026-10-10-public-release-design.md)
- [ADK-only foundation and chapter 1](superpowers/specs/2026-10-13-adk-only-foundation-chapter-01-design.md)
- [Chapter 2: listing agent and human review](superpowers/specs/2026-10-13-chapter-02-listing-agent-design.md)
- [ADK 2.3.0 and chapter 3](superpowers/specs/2026-10-14-adk-2.3.0-and-chapter-03-design.md)
- [Chapter 4: the agents in Google Cloud](superpowers/specs/2026-10-14-chapter-04-cloud-design.md)

The specs record decisions and what was left out on purpose. The public
release spec, for example, records the decision that chapter 3 stops before
posting a listing and hands over to a person. The [roadmap](roadmap.md)
explains why.

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

- **Writing the spec first is where most of the thinking happens.** The plans
  and the code that follow are much less surprising.
- **Match the model to the job.** A top model for design and hard problems,
  faster agents for deterministic chores: more gets done, and the expensive
  reasoning goes where it pays off.
- **Isolation makes parallel agents safe.** One worktree per agent turned three
  agents from a risk into a multiplier.
- **An agent needs what a new colleague needs:** context, clear rules, and a
  way to check its own work. `AGENTS.md` and the verification script are that,
  and they are what made a seven-hour run without a single question possible.
- **A check that a script can run beats a rule that someone has to
  remember.**

Working this way has been one of the most exciting shifts in my career so far,
and I would love to bring it to a team. You can reach me through
[my GitHub profile](https://github.com/lukas-zech-software).
