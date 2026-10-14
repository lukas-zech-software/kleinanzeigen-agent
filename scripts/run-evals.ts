// Runs the eval set of the publisher agent with ADK's eval runner.
//
// `adk eval` is ADK's command for this. In ADK 2.3.0 it cannot load an agent file, so this script
// calls the function behind it, `runEvals`, with the same eval set file and the same config file.
// Usage: npm run eval:publisher [-- <case name> ...]
import { readFileSync } from 'node:fs';
import {
  EvalStatus,
  LogLevel,
  getEvaluationCriteriaOrDefault,
  runEvals,
  setLogLevel,
  type EvalEntry,
} from '@google/adk';
import { publisherAgent } from '../src/agents/publisher-agent.js';

// TODO(ch03-6): Add two cases to examples/evals/publisher.evalset.json.
// The file has one case: a draft that is not approved, where the agent must
// call no tool. Add a case for `examples/drafts/approved.md` and one for
// `examples/drafts/title-too-long.md`. Each case gives the draft path in
// `initial_session.state` and lists in `expected_tool_use` the tool calls a
// correct run makes, with `tool_name` and `tool_input`. ADK compares them
// exactly, and `prepare_listing` takes no arguments, so its `tool_input` is
// an empty object. Think about the third case: the tool rejects the listing,
// but is it still called?
const EVAL_SET_FILE = 'examples/evals/publisher.evalset.json';
const CONFIG_FILE = 'examples/evals/test_config.json';

// ADK logs every model request at INFO. Show warnings and errors only.
setLogLevel(LogLevel.WARN);

const wanted = process.argv.slice(2);
const allCases: EvalEntry[] = JSON.parse(readFileSync(EVAL_SET_FILE, 'utf8'));
const cases =
  wanted.length > 0 ? allCases.filter((entry) => wanted.includes(entry.name)) : allCases;
if (cases.length === 0) {
  console.error(
    `No eval case to run. ${EVAL_SET_FILE} has: ${allCases.map((entry) => entry.name).join(', ') || 'no cases'}.`,
  );
  process.exit(1);
}

const criteria = getEvaluationCriteriaOrDefault(CONFIG_FILE);
const evalMetrics = Object.entries(criteria).map(([metric_name, threshold]) => ({
  metric_name,
  threshold,
}));

let passed = 0;
let failed = 0;
for await (const result of runEvals({
  evalCasesByEvalSetId: { [EVAL_SET_FILE]: cases },
  rootAgent: publisherAgent,
  evalMetrics,
})) {
  const scores = result.overall_eval_metric_results
    .map((metric) => `${metric.metric_name} ${metric.score} (needs ${metric.threshold})`)
    .join(', ');
  console.log(`${result.eval_id}: ${EvalStatus[result.final_eval_status]}  ${scores}`);
  if (result.final_eval_status === EvalStatus.PASSED) {
    passed += 1;
  } else {
    failed += 1;
  }
}

console.log(`Eval cases passed: ${passed}, failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
