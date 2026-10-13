import { LogLevel, setLogLevel } from '@google/adk';

// ADK logs every model request at INFO. The `--log_level` option of `adk run` does not reach the
// copy of ADK that this file loads, so the level is set here.
setLogLevel(LogLevel.WARN);

export { listingAgent as rootAgent } from '../src/agents/listing-agent.js';
