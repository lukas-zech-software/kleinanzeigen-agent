# Roadmap

The tutorial builds one agent across four chapters. Each chapter adds one
layer and leaves you with something that runs.

| Chapter | Topic                                   | Status    |
| ------- | --------------------------------------- | --------- |
| 1       | Foundation, setup and specialist agents | Available |
| 2       | Listing agent and human review          | Available |
| 3       | Publisher agent and human handoff       | Available |
| 4       | Cloud deployment with events            | Planned   |

Chapter 4 is planned. Its content may change while it is written.

## Chapter 1: Foundation, setup and specialist agents

**You need:** Node.js 26 or newer, npm, and a Google AI Studio API key in
`GEMINI_API_KEY`.

**Goal:** Two ADK agents, each with one job. `vision_inspector` describes the
item in a photo as structured output. `price_evaluator` researches a
realistic second-hand price range with Google Search. Every model call goes
through ADK: you create no Gemini client.

**You implement:**

- the output schema of each agent, in Zod,
- a before-model callback that reads the photo path from the session state
  and adds the photo to the request,
- both agents: description, instruction, the output schema or the search
  tool,
- the function that turns the price agent's text answer into a validated
  object.

**Done when:** `npm run typecheck` and `npm run test:offline` pass, and
`npm run test:agents` prints a valid result from each agent for a photo,
with at least one search query the price agent ran.

**Docs:** [ADK agents](https://adk.dev/agents/llm-agents/),
[ADK callbacks](https://adk.dev/callbacks/types-of-callbacks/),
[ADK session state](https://adk.dev/sessions/state/),
[Google Search tool for ADK](https://adk.dev/integrations/google-search/),
[Zod](https://zod.dev/).

## Chapter 2: Listing agent and human review

**You need:** chapter 1. Nothing else: the draft is a local file.

**Goal:** A third agent that uses the two agents from chapter 1 through
`AgentTool` and writes a listing draft that a person can read and edit. The
draft is a Markdown file with YAML frontmatter, saved beside the photo. A
status field in the frontmatter (`status: draft` or `status: freigegeben`,
German for "approved") is the only link between the agent and the person, so
no server session has to stay alive. You run and inspect the agent with ADK's
own dev tools and write no runner.

**You implement:**

- the input schema of the `create_listing_draft` tool,
- the tool, which reads the photo path from the session state and saves the
  draft beside the photo,
- the listing agent with both chapter 1 agents and the tool,
- its instruction, including what it does when a tool returns nothing,
- a function that reads the tool calls from a saved session.

**Done when:** `npm run test:offline` passes, and after `npm run
agent:listing` the session check passes and the draft beside the photo has
valid frontmatter, `status: draft`, and a price and description that match
the photo.

**Docs:** [ADK agents](https://adk.dev/agents/llm-agents/),
[ADK function tools](https://adk.dev/tools-custom/function-tools/),
[ADK session state](https://adk.dev/sessions/state/),
[ADK events](https://adk.dev/events/).

## Chapter 3: Publisher agent and human handoff

**You need:** chapters 1 and 2.

**Goal:** A second agent that takes an approved draft and prepares it for
posting. It does not post. Posting is the step that cannot be undone, so the
agent stops in front of it and hands a checked package to a person. The
chapter is about the boundary between what an agent may do alone, what a tool
decides, and what stays with a human.

**You implement:**

- the parser that reads a draft a person edited,
- the listing rules: an approved status, a title of at most 65 characters,
  and an image that exists,
- a `prepare_listing` tool that reads the draft itself, checks it, and writes
  the ready-to-post package: the fields as JSON with a short checklist for
  the person who posts it,
- a before-agent callback that stops the agent before the model runs when the
  draft is not approved,
- the publisher agent, which reads the listing critically and writes the
  handoff note,
- eval cases that state what a correct run does.

**Done when:**

- run against a draft with `status: draft`, the agent answers without calling
  the model or a tool,
- run against a draft with `status: freigegeben`, it writes a package,
- a listing with a title that is too long is rejected with a message that
  names the field,
- `npm run test:offline` and `npm run eval:publisher` pass.

**Docs:** [ADK callbacks](https://adk.dev/callbacks/types-of-callbacks/),
[ADK function tools](https://adk.dev/tools-custom/function-tools/),
[ADK evaluation](https://adk.dev/evaluate/).

## Chapter 4: Cloud deployment with events

**You need:** chapters 1 to 3, the `gcloud` CLI, and a Google Cloud project
with Cloud Run, Eventarc, Artifact Registry, and Cloud Build enabled.

**Goal:** The workflow runs in the cloud without a machine that stays on. Both
agents become Cloud Run services that scale to zero, and storage events start
them.

**You implement:**

- a multi-stage `Dockerfile` for the TypeScript services,
- two Cloud Run services: one that creates the draft and one that prepares the
  package,
- a Cloud Storage bucket in place of the local folder, with Eventarc triggers:
  a new image starts the first service, an updated draft starts the second.

**Done when:** uploading a photo to the bucket produces a draft, and uploading
the draft again with `status: freigegeben` produces the ready-to-post package.
Both runs are visible in Cloud Logging.

**Docs:** [Deploying Node.js services on Cloud Run](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service),
[Eventarc overview](https://cloud.google.com/eventarc/docs/overview),
[Service identity on Cloud Run](https://cloud.google.com/run/docs/securing/service-identity).
