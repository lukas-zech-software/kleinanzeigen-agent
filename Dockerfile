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

# Cloud Run sends requests to the port in $PORT, 8080 by default.
CMD ["sh", "-c", "exec npx adk api_server adk --host=0.0.0.0 --port=${PORT:-8080} --log_level=info"]
