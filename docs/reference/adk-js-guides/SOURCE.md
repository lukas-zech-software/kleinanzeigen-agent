# Source of this folder

A copy of the developer guides of the ADK TypeScript implementation, kept in
the repository so that every coding agent can read them without a network.

- Repository: https://github.com/google/adk-js
- Path: `docs/guides/`, plus `docs/adk-ts-improvements.md`
- License: Apache License 2.0, copyright Google LLC. The license text is in
  [LICENSES/Apache-2.0.txt](../../../LICENSES/Apache-2.0.txt).
- The branch, the commit, its date, and the ADK version the copy was checked
  against are in [VERSION](VERSION).

The files are unchanged. Links that point outside `docs/guides/`, for example
to `samples/`, do not resolve here. `scripts/update-adk-guides.sh` replaces
the copy and keeps this file.

## The guides and the release

The guides describe the `main` branch of the repository, which can be ahead
of the version this project installs. Before you rely on a symbol, confirm
that `node_modules/@google/adk/dist/types` exports it.

Checked against `@google/adk` 2.3.0 on 2026-10-14:

- Every symbol that the guides name and that 2.2.1 lacked is exported now:
  `runEvals`, `convertSessionToEvalFormat`, `parseAndGetEvalsToRun`,
  `getEvaluationCriteriaOrDefault`, `createEmptyState`, `logToStderr`,
  `logToTmpFolder`, `loadDotenvForAgent`, `walkToRootUntilFound`,
  `createLlmResponse`, and `appendInstructions`.
- The command `adk eval` exists, and it cannot load an agent file: it fails
  with `Cannot find module 'file:///…'`. Call `runEvals` instead, as
  `scripts/run-evals.ts` does.

Update this section when the guides or the ADK version change.
