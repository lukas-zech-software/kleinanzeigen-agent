# Contributing

Thank you for helping to improve this tutorial.

## Questions and feedback

- A question about a chapter or about ADK: start a thread in
  [Discussions](https://github.com/lukas-zech-software/kleinanzeigen-agent/discussions).
- An error in the tutorial, such as a wrong instruction, a broken link, or code
  that no longer works with a newer ADK release: open an
  [issue](https://github.com/lukas-zech-software/kleinanzeigen-agent/issues).
  Name the chapter and the release tag you started from.
- A security problem: see [SECURITY.md](SECURITY.md).

## Pull requests

Small fixes are welcome. Open the pull request against the earliest branch the
fix belongs to: `main` for shared files such as the README or the
`check-chapter` skill, a chapter branch for that chapter's code. Run
`npm run format` before you commit.

The chapter branches are rebased when the tutorial is corrected, so a pull
request is applied by the maintainer and then replayed through the chain as
described below.

## Maintaining the chain

```
main ── chapter-01-starter ── chapter-01-solution ── chapter-02-starter ── …
```

1. Commit the fix on the earliest branch it belongs to (`main` for anything
   shared, such as the README or the skill).
2. When the fix is a new release, update the tag numbers in `README.md` and in
   `main`'s `CURRENT_CHAPTER.md` to the release you are about to cut.
3. Replay the rest of the chain onto it. From the last branch in the chain:

   ```sh
   git switch chapter-01-solution
   git rebase --update-refs <branch-you-fixed>
   ```

4. Verify: `scripts/verify-chain.sh`
5. Cut the next release on every chain branch, for example:

   ```sh
   git tag -a chapter-01-starter-v3 chapter-01-starter -m "Chapter 1 starter, release v3"
   git tag -a chapter-01-solution-v3 chapter-01-solution -m "Chapter 1 solution, release v3"
   ```

6. Push: `git push --force-with-lease origin main chapter-01-starter chapter-01-solution`
   and `git push origin --tags`.

Release tags never move. A ruleset on GitHub rejects an update or a deletion
of a `chapter-*-v*` tag.

When you add a chapter, append its two branches to `CHAIN` in
`scripts/verify-chain.sh`, add its criteria file under
`.claude/skills/check-chapter/chapters/`, and replace `CURRENT_CHAPTER.md` on
the starter with the chapter's content. Its first line must be
`# Chapter N: …`.

Design specs live in `docs/superpowers/specs/` and implementation plans in
`docs/superpowers/plans/`. A plan that quotes a reference solution stays on a
maintainer branch and off the chain.
