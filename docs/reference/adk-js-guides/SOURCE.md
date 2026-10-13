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

## The guides are ahead of the release

The guides describe the `main` branch of the repository, and `main` is ahead
of the version this project installs. Checked against `@google/adk` 2.2.1 on
2026-10-13, these symbols are named in the guides and not exported by the
package:

- `runEvals`, `convertSessionToEvalFormat`, `parseAndGetEvalsToRun`,
  `getEvaluationCriteriaOrDefault`, and the `adk eval` command
- `createEmptyState`
- `logToStderr`, `logToTmpFolder`
- `loadDotenvForAgent`, `walkToRootUntilFound`
- `createLlmResponse`, `appendInstructions`

Before you rely on a symbol, confirm that
`node_modules/@google/adk/dist/types` exports it. Update this list when the
guides or the ADK version change.
