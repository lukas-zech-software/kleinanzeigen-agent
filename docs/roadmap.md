# Roadmap

The tutorial builds one agent across four chapters. Each chapter adds one
layer and leaves you with something that runs.

| Chapter | Topic                             | Status    |
| ------- | --------------------------------- | --------- |
| 1       | Foundation, setup and tool design | Available |
| 2       | Listing agent and human review    | Planned   |
| 3       | Publisher agent and human handoff | Planned   |
| 4       | Cloud deployment with events      | Planned   |

Chapters 2 to 4 are planned. Their content may change while they are written.

## Chapter 1: Foundation, setup and tool design

**You need:** Node.js 26 or newer, npm, and a Google AI Studio API key in
`GEMINI_API_KEY`.

**Goal:** Two ADK tools with typed interfaces. `VisionInspectorTool` describes
the item in a photo. `PriceEvaluatorTool` researches a realistic second-hand
price range. An agent can only decide well when its tools have clear input and
output schemas, so each tool gets a Zod schema for both.

**You implement:**

- the input and output schema of each tool,
- the multimodal call that turns a photo into structured JSON, using the
  current Gemini Flash model set in `src/config.ts`,
- the price research, for example with Gemini and Google Search grounding.

**Done when:** `npm run typecheck` passes and `npm run test:tools` prints a
valid result from each tool for a photo.

**Docs:** [ADK multi-tool agent tutorial](https://adk.dev/tutorials/multi-tool-agent/),
[ADK tool concepts and schemas](https://adk.dev/live/tools/),
[Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding),
[Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search),
[Zod](https://zod.dev/).

## Chapter 2: Listing agent and human review

**You need:** chapter 1, plus access to a Google Drive folder through a
service account (`GOOGLE_APPLICATION_CREDENTIALS`, `GDRIVE_WATCH_FOLDER_ID`).

**Goal:** The first agent. It uses the two tools from chapter 1 and writes a
listing draft that a person can read and edit. The draft is a Markdown file
with YAML frontmatter. A status field in the frontmatter (`status: draft` or
`status: freigegeben`, German for "approved") is the only link between the
agent and the person, so no server session has to stay alive.

**You implement:**

- the agent definition: instruction, model, and the registered tools,
- a `create_listing_draft` tool that writes the frontmatter (`title`, `price`,
  `category`, `status: "draft"`) and the listing text, and saves the file next
  to the photo in Google Drive,
- the orchestration: inspect the photo, choose search terms for the price,
  write the description, save the draft.

**Done when:** running the agent on a photo in the Drive folder creates a
draft file beside it with valid frontmatter, `status: draft`, and a price and
description that match the photo.

**Docs:** [ADK agents](https://adk.dev/agents/),
[Google Drive API for Node.js](https://developers.google.com/workspace/drive/api/quickstart/nodejs).

## Chapter 3: Publisher agent and human handoff

**You need:** chapters 1 and 2.

**Goal:** A second agent that takes an approved draft and prepares it for
posting. It does not post. Posting is the step that cannot be undone, so the
agent stops in front of it and hands a checked package to a person. The
chapter is about the boundary between what an agent may do alone and what
stays with a human.

**You implement:**

- the parser that reads a draft and refuses to continue while the status is
  still `draft`,
- a `prepare_listing` tool that validates the listing before anything leaves
  the system: a title of at most 65 characters, a price, a category, a
  description, and at least one image that exists,
- the publisher agent, which runs the final consistency checks, calls the tool,
  and writes a ready-to-post package: the validated fields as JSON next to the
  images, with a short checklist for the person who posts it.

**Done when:**

- run against a file with `status: draft`, the agent stops and calls no tool,
- run against a file with `status: freigegeben`, it writes a package that
  passes validation,
- an invalid listing, such as a title that is too long, is rejected with a
  message that names the field.

**Docs:** [ADK custom tools](https://adk.dev/tools-custom/),
[Model Context Protocol in ADK](https://adk.dev/mcp/).

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
- a Cloud Storage bucket in place of the Drive folder, with Eventarc triggers:
  a new image starts the first service, an updated draft starts the second.

**Done when:** uploading a photo to the bucket produces a draft, and uploading
the draft again with `status: freigegeben` produces the ready-to-post package.
Both runs are visible in Cloud Logging.

**Docs:** [Deploying Node.js services on Cloud Run](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service),
[Eventarc overview](https://cloud.google.com/eventarc/docs/overview),
[Service identity on Cloud Run](https://cloud.google.com/run/docs/securing/service-identity).
