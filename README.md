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

Work through the `TODO(ch01-…)` blocks. Delete each TODO comment when its task
is done: the chapter check counts a remaining marker as open work. Check
yourself at any time:

```sh
npm run typecheck
npm run test:tools -- path/to/photo.jpg
```

In Claude Code, ask "is my chapter done?" to run the `check-chapter` skill. It
tells you which goals are still open and where to look. It does not show you
the solution.

To see the reference solution:

```sh
git diff chapter-01-starter-v1 chapter-01-solution-v1
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

Design specs live in `docs/superpowers/specs/`. Implementation plans quote the
reference solutions, so keep them on a maintainer branch and off the chain.
