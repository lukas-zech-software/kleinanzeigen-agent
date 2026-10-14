# Chapter 3 criteria: Publisher Agent and Human Handoff

Goal: an ADK agent, `publisher_agent`, that takes a listing draft a person
approved, checks it, and writes a ready-to-post package. It never posts, and
it does nothing with a draft that is not approved.

Script command: `npm run test:offline`
Live test command: `npm run eval:publisher`
Live test setup: The command reads the drafts in `examples/drafts/` and
writes a package file beside each approved one. Git ignores these
`*.listing.json` files. After the command, delete the ones it wrote in
`examples/drafts/`. Then run `npm run agent:publisher` to judge
`ch03-live-2`, and delete `examples/drafts/approved.listing.json` and
`adk/publisher-agent.session.json` afterwards.
Required key: `GEMINI_API_KEY`

## ch03-1 Draft parser

- Type: static
- Target: `src/draft/read-draft.ts`, export `parseDraft`
- Requirement: splits the frontmatter block from the text, parses the block
  as YAML, and returns the result validated with `listingDraftSchema`, with
  the text as `description`. Throws a `DraftFormatError` that says what is
  wrong for a missing block, a block that is not closed, invalid YAML, and a
  field that does not match the schema, naming the field. Accepts `\r\n`
  line endings. It no longer throws "not implemented".
- Hint: A person edits this file by hand, so every way it can be broken needs
  a message that helps them fix it. The schema from chapter 2 already knows
  what a valid draft is.
- Docs: https://zod.dev/

## ch03-2 Listing rules

- Type: static
- Target: `src/listing/rules.ts`, export `findProblems`
- Requirement: returns one problem with `field` and `message` for each broken
  rule, and an empty list for none: the status is `freigegeben`, the title
  has at most `MAX_TITLE_LENGTH` characters, and the image exists as a file,
  resolved from the folder of the draft. It reports every broken rule, not
  only the first. It no longer throws "not implemented".
- Hint: A check that stops at the first problem makes a person fix a draft
  three times. A message that names the field and the limit can be acted on.
- Docs: https://adk.dev/tools-custom/function-tools/

## ch03-3 Prepare tool

- Type: static
- Target: `src/tools/prepare-listing.ts`, export `prepareListing`
- Requirement: takes the draft path from the session state, reads the draft
  itself, and checks it with `findProblems`. Writes the package with
  `writePackage` and returns its path when there is no problem. Returns an
  error result with the problems otherwise, also for a missing path and for a
  draft that cannot be read. Writes no package for a rejected draft. The tool
  takes no arguments. It no longer throws "not implemented".
- Hint: This tool is the last check before a person posts, so it trusts
  nothing it was told and reads the file again. A tool without arguments
  cannot be handed a wrong path or a changed price by the model.
- Docs: https://adk.dev/tools-custom/function-tools/

## ch03-4 Approval gate

- Type: static
- Target: `src/agents/publisher-agent.ts`, export `requireApprovedDraft`
- Requirement: a before-agent callback that returns an answer, so that the
  model is not called, when the draft path is missing, the draft cannot be
  read, or its status is not `freigegeben`. Otherwise it stores the draft in
  the session state under `LISTING_KEY` and returns nothing. It no longer
  throws "not implemented".
- Hint: An instruction asks the model to follow a rule. A callback that
  answers before the model runs enforces it. Use the callback for the rule
  that must hold every time.
- Docs: https://adk.dev/callbacks/types-of-callbacks/

## ch03-5 Publisher agent

- Type: static
- Target: `src/agents/publisher-agent.ts`, export `publisherAgent`
- Requirement: an `LlmAgent` named `publisher_agent` with a description, the
  model from `src/config.ts` given as a name, `prepareListingTool` as its
  only tool, and `requireApprovedDraft` as its before-agent callback. The
  instruction reads the listing through the `{listing}` placeholder, tells
  the agent to call `prepare_listing` exactly once, and to answer with the
  package path and what the person should check, or with the problems. It
  says that the agent never posts.
- Hint: The agent's judgement is useful for what a rule cannot express: does
  the text fit the title and the price. Whether the listing may be posted is
  decided by the tool, so the agent calls it in every case.
- Docs: https://adk.dev/agents/llm-agents/

## ch03-6 Eval cases

- Type: static
- Target: `examples/evals/publisher.evalset.json`, and the `TODO(ch03-6)`
  marker in `scripts/run-evals.ts`
- Requirement: the eval set has a case for a draft that is not approved,
  which expects no tool call, a case for an approved valid draft, and a case
  for an approved draft with a problem. The last two expect exactly one call
  of `prepare_listing` with an empty `tool_input`. Each case gives its draft
  path in `initial_session.state`.
- Hint: An eval case states what a correct run does, as tool calls. ADK
  compares the calls exactly, which works here because the tool takes no
  arguments. A draft the tool rejects is still a draft the agent must hand to
  the tool.
- Docs: https://adk.dev/evaluate/

## ch03-tc Typecheck

- Type: typecheck
- Target: whole project
- Requirement: `npx tsc --noEmit` exits 0.
- Hint: Read the first error only; later ones often follow from it.
- Docs: https://adk.dev/agents/llm-agents/

## ch03-script Offline test

- Type: script
- Target: `scripts/test-offline-chapter-03.ts`
- Requirement: `npm run test:offline` exits 0.
- Hint: The failing assertion names its case. Cases 1 to 9 are chapters 1 and 2. Case 10 is the parser, 11 the rules, 12 the tool, 13 the approval gate,
  14 the agent, and 15 the eval set.
- Docs: https://adk.dev/tools-custom/function-tools/

## ch03-live-1 The eval set passes against the model

- Type: live
- Target: `scripts/run-evals.ts`
- Requirement: the output lists at least three cases, each with `PASSED`, and
  ends with `Eval cases passed: 3, failed: 0` or more passed and none failed.
  The script exits 0.
- Hint: A failed case for an approved draft means the agent did not call the
  tool exactly once. Say so in the instruction, and say that it calls the
  tool also when it has doubts about the listing.
- Docs: https://adk.dev/evaluate/

## ch03-live-2 The handoff is useful and honest

- Type: live
- Target: the output of `npm run agent:publisher`, and
  `examples/drafts/approved.listing.json`
- Requirement: the answer names the package file and gives the person points
  to check before posting. It does not claim that the listing was posted.
  The package file holds the fields of the draft, its image, and the
  checklist.
- Hint: If the answer says the listing is online, the instruction does not
  say clearly enough where the agent's job ends.
- Docs: https://adk.dev/agents/llm-agents/
