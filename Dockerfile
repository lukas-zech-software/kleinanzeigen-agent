# The container for Cloud Run: the ADK API server with every agent in adk/.
FROM node:26-alpine
WORKDIR /app

# The exact versions from package-lock.json. The adk command comes from @google/adk-devtools.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
COPY adk ./adk

# Gemini through the Gemini API and the key in GEMINI_API_KEY, as on your machine, so the usage
# shows up where you watch it in AI Studio. ADK switches to Vertex AI, billed to the Cloud project,
# when this variable is true; `adk deploy cloud_run` sets it to 1. Here it is off on purpose.
ENV GOOGLE_GENAI_USE_ENTERPRISE=false

# Run as the unprivileged user of the Node image, not as root.
USER node

# TODO(ch04-1): Start ADK's API server for the agents in adk/ here, as the CMD of the image.
# Cloud Run sends requests to the port in the variable PORT (8080 unless it says otherwise), and
# the server must listen on all interfaces of the container, not only on 127.0.0.1.
# Docs: https://adk.dev/runtime/api-server/ and https://docs.docker.com/reference/dockerfile/#cmd
