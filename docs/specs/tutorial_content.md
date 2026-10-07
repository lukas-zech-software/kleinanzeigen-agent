## Chapter 1: Foundation, Setup & Tool Design in the ADK (TypeScript)

### 1. Prerequisites

* **Development Environment & Runtimes:** Node.js (v26+ LTS), TypeScript (`tsc` v7+), package manager (`npm` or `pnpm`).
* **Google Cloud & API Access:** Active Google Cloud project with the Vertex AI API enabled or a Google AI Studio API key.
* **Environment Variables:** `GEMINI_API_KEY` (for direct access) or `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`.
* **Dependencies:** `@google/adk`, `@google/genai` (or `@google-cloud/aiplatform`), `zod` (for type safety and schema validation), `dotenv`, `tsx` (for TypeScript execution during development).

### 2. Goals of this Chapter

* **What will be implemented:** Setting up the TypeScript project scaffolding and defining the first two functional ADK tools (`VisionInspectorTool` and `PriceEvaluatorTool`).
* **Why:** Before an agent can make autonomous decisions, it requires deterministic interfaces with clearly typed input and output schemas.
* **What improves afterward:** Unstructured image data and price research are transformed into reliable, strictly typed JSON structures that the agent can process in a fault-tolerant manner.

### 3. Implementation

* **Project Initialization:** Setting up the TypeScript project with a modern ESM target, configuring `../../tsconfig.json`, and managing environment variables via `dotenv`.
* **Vision Inspector Tool:**
  * Definition of the input schema (`imagePath` or GCS URI, optional MIME type).
  * Definition of the output schema via Zod: `title` (suggestion), `detectedCategory`, `condition` (condition: new/used/defective), `keyAttributes` (array of strings such as brand, model, color).
  * Integration with Gemini 1.5 Pro / Flash for multimodal extraction.
* **Price Evaluator Tool:**
  * Definition of the input schema (`itemQuery`, `condition`).
  * Implementation of research logic to determine a realistic used price range (`priceMin`, `priceMax`, `recommendedPrice`, `currency`).
* **Official Documentation & References:**
  * [Google ADK TypeScript Multi-Tool Tutorial](https://adk.dev/tutorials/multi-tool-agent/)
  * [Google ADK Tool Concepts & Schemas](https://adk.dev/live/tools/)
  * [Google Vertex AI Multimodal Analysis (Node.js/TypeScript)](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/overview)
  * [Zod Type Definition & Schema Validation](https://zod.dev/)

### 4. Validation

* **Automated Tool Test:** Executing a test script (`npx tsx scripts/test-tools.ts`) that passes a local test image (e.g., a smartphone or keyboard).
* **Verification Criteria:**
  * The `VisionInspectorTool` returns a valid Zod object with plausible attributes.
  * The `PriceEvaluatorTool` generates a numerical price range based on the detected attributes.
  * No type errors during compilation via `tsc --noEmit`.

---

## Chapter 2: The Listing Orchestrator Agent & Human-in-the-Loop Pattern

### 1. Prerequisites

* All prerequisites from **Chapter 1** must be met.
* **Additional Dependencies:** `gray-matter` (for parsing and serializing Markdown with YAML frontmatter), `@googleapis/drive` (for accessing Google Drive).
* **Additional Configuration:** `GOOGLE_APPLICATION_CREDENTIALS` (service account key with permissions for the target Google Drive folder) and `GDRIVE_WATCH_FOLDER_ID`.

### 2. Goals of this Chapter

* **What will be implemented:** Creating the autonomous listing agent in the ADK that orchestrates the tools from Chapter 1 and saves the result as a Markdown draft with YAML frontmatter to the file system or Google Drive.
* **Why:** Generative outputs must be reviewable and editable for human reviewers. A stateless file flag (`status: draft` vs. `status: freigegeben`) decouples the agent from the human without requiring a persistent server session.
* **What improves afterward:** A raw image is turned fully automatically into a readable, customizable listing draft directly in the user's Google Drive.

### 3. Implementation

* **Agent Definition:** Configuring the ADK agent with a system prompt, listing creation instructions, and registering both the `VisionInspectorTool` and `PriceEvaluatorTool`.
* **Draft Writer Tool:**
  * Implementation of an ADK tool `create_listing_draft` that accepts the listing title, price, description, and metadata.
  * File structuring: YAML frontmatter for programmatic control data (`title`, `price`, `status: "draft"`, `category`) and a Markdown body for the listing copy.
  * Saving the `.md` file via `@googleapis/drive` in the same folder as the source image.
* **Orchestration Logic:** The agent analyzes the image, autonomously decides on search terms for pricing, drafts the description, and persists the result.
* **Official Documentation & References:**
  * [Google ADK Core Agent Architecture](https://adk.dev/agents/)
  * [Google Drive API Client for Node.js / TypeScript](https://developers.google.com/workspace/drive/api/quickstart/nodejs)
  * [Human-in-the-Loop AI Architecture Guidelines](https://docs.cloud.google.com/architecture/multiagent-ai-system)

### 4. Validation

* **Workflow Execution:** Starting the agent with an image ID from Google Drive.
* **Verification Criteria:**
  * A new file exists in the Google Drive folder alongside the image (e.g., `{image_name}_anzeige.md`).
  * The file contains syntactically valid YAML frontmatter with `status: draft`.
  * The proposed price and item description match the image content.

---

## Chapter 3: External Tool Calling & Kleinanzeigen-Bot Integration

### 1. Prerequisites

* All prerequisites from **Chapters 1 and 2** must be met.
* **Additional Tools & Runtimes:** Local Docker installation (optional for an isolated browser) or installed Playwright browser binaries (`npx playwright install chromium`).
* **Additional Dependencies:** `playwright`, `playwright-stealth`.
* **Additional Configuration:** `KLEINANZEIGEN_STORAGE_STATE_PATH` (path to the exported session/cookie JSON to bypass login prompts).

### 2. Goals of this Chapter

* **What will be implemented:** A second ADK agent (Publisher Agent) and an external tool serving as an adapter to control the actual Kleinanzeigen bot or Playwright script.
* **Why:** External third-party systems without an official API must not destabilize the core agent. Strict encapsulation as a tool with pre-validation ensures that only error-free payloads are submitted.
* **What improves afterward:** The publishing step executes fully automatically as soon as the status in the Markdown file is changed to `freigegeben`.

### 3. Implementation

* **Parser Logic for Approved Drafts:** Service logic that reads the Markdown file, parses the frontmatter, and verifies that `status: freigegeben` is set (aborts if still `draft`).
* **Kleinanzeigen Publisher Tool:**
  * Definition of the ADK tool `publish_listing` with parameters: `title` (validated to a maximum of 65 characters), `description`, `price`, `images`, `category`.
  * Integration of the Playwright script or invocation of the `kleinanzeigen-bot` CLI tool via TypeScript `child_process`/wrapper.
  * Loading persistent browser context (session cookies).
  * Populating the web form and uploading image file(s).
* **Publisher Agent:** A lightweight ADK agent that interprets the file content, performs final consistency checks, and triggers the publisher tool.
* **Official Documentation & References:**
  * [Google ADK Custom Tools & Callbacks](https://adk.dev/tools-custom/)
  * [Model Context Protocol (MCP) Integration in the ADK](https://adk.dev/mcp/)
  * [Playwright Browser Automation Documentation](https://playwright.dev/docs/intro)

### 4. Validation

* **Dry-Run & Real-Run Test:**
  * **Test A (Abort Condition):** Executing the Publisher Agent against a file with `status: draft` $\rightarrow$ the agent aborts and invokes no tools.
  * **Test B (Successful Invocation):** Changing the file status to `status: freigegeben`. Starting the agent with a headed browser (`headless: false`).
* **Verification Criteria:**
  * The browser opens with loaded session cookies, fills out the form, uploads the image, and returns a success confirmation or listing ID.

---

## Chapter 4: Cloud Deployment & Event-Driven Execution (Cloud Run & Eventarc)

### 1. Prerequisites

* All prerequisites from **Chapters 1 through 3** must be met.
* **Google Cloud CLI:** `gcloud` CLI installed and authenticated against the target project (`gcloud auth login`).
* **GCP API Activation:** `run.googleapis.com`, `eventarc.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`.
* **Permissions:** IAM roles `roles/run.admin`, `roles/eventarc.admin`, and `roles/iam.serviceAccountUser`.

### 2. Goals of this Chapter

* **What will be implemented:** Containerizing both agents, deploying them to Google Cloud Run, and wiring them via Eventarc and Cloud Storage events.
* **Why:** The workflow should run entirely serverless in the cloud without requiring a local machine to remain powered on continuously. During inactivity, services scale to zero instances (minimizing costs).
* **What improves afterward:** Uploading a photo to the cloud automatically triggers the pipeline; updating the file status publishes the listing—fully automated, cloud-native, and scalable.

### 3. Implementation

* **Containerization:**
  * Creating a `Dockerfile` (multi-stage build for TypeScript).
  * Providing Chromium and required Linux libraries for Playwright inside the Docker image.
* **Cloud Run Services:**
  * Deployment of Service 1: `listing-orchestrator-service` (generates the draft).
  * Deployment of Service 2: `listing-publisher-service` (executes the listing).
* **Event-Driven Architecture with Eventarc:**
  * Setting up a Google Cloud Storage (GCS) bucket as the cloud counterpart to the Drive folder.
  * Configuring Eventarc triggers:
    * Event `google.cloud.storage.object.v1.finalized` (filtered for image extensions like `.jpg`) triggers `listing-orchestrator-service`.
    * Event `google.cloud.storage.object.v1.finalized` (filtered for `.md`) triggers `listing-publisher-service`.
* **Official Documentation & References:**
  * [Deploying Node.js & TypeScript Services on Google Cloud Run](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service)
  * [Google Cloud Eventarc Overview & Cloud Storage Triggers](https://cloud.google.com/eventarc/docs/overview)
  * [Running Headless Chromium / Playwright on Google Cloud Run](https://docs.cloud.google.com/run/docs/browser-automation)
  * [Service Identity and Security Best Practices for Cloud Run](https://cloud.google.com/run/docs/securing/service-identity)

### 4. Validation

* **End-to-End Cloud Test:**
  * Step 1: A photo of a test item is uploaded to the configured cloud bucket.
  * Step 2: Verification in Google Cloud Logging / Cloud Run logs that `listing-orchestrator-service` triggers and creates a `listing.md` in the bucket.
  * Step 3: Downloading the `.md` file, manually updating the flag to `status: freigegeben`, and uploading it again.
  * Step 4: Verification in the logs that `listing-publisher-service` triggers and publishes the listing successfully.
