#!/usr/bin/env bash
# Fails when the source code uses an API this project bans.
# The reasons are in docs/adr/0001-model-access-through-adk.md.
# Usage: scripts/check-banned-apis.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Tracked and new TypeScript files of the folders that hold code. Empty on main.
files=$(git ls-files --cached --others --exclude-standard -- src scripts adk | grep '\.ts$' || true)

failed=0
report() {
  echo "FAIL $1" >&2
  failed=1
}

check_pattern() {
  local pattern=$1 reason=$2 hits
  [ -n "$files" ] || return 0
  hits=$(echo "$files" | tr '\n' '\0' | xargs -0 grep -n -E "$pattern" /dev/null || true)
  if [ -n "$hits" ]; then
    while IFS= read -r hit; do
      report "$hit  ($reason)"
    done <<<"$hits"
  fi
}

check_pattern 'useInteractionsApi' 'the Interactions API is banned'
check_pattern 'interactions\.create|\.interactions\.' 'the Interactions API is banned'
check_pattern 'GoogleGenAI' 'ADK is the only layer that calls the model'

# An import from @google/genai needs a reason on the line above it.
genai_imports=0
if [ -n "$files" ]; then
  while IFS= read -r file; do
    [ -f "$file" ] || continue
    hits=$(awk -v file="$file" '
      /@google\/genai/ && /(import|require|from)/ {
        found = 1
        if (previous !~ /^[[:space:]]*\/\/ genai-import: [^[:space:]]/) {
          printf "%s:%d:%s\n", file, NR, $0
        }
      }
      { previous = $0 }
      END { exit found ? 0 : 3 }
    ' "$file") && genai_imports=1 || [ $? -eq 3 ]
    if [ -n "$hits" ]; then
      while IFS= read -r hit; do
        report "$hit  (an import from @google/genai needs a '// genai-import: <reason>' comment on the line above)"
      done <<<"$hits"
    fi
  done <<<"$files"
fi

# The dependency is declared only when an import needs it.
if [ -f package.json ] && grep -q '"@google/genai"' package.json && [ "$genai_imports" -eq 0 ]; then
  report "package.json lists @google/genai, but no source file imports it"
fi

if [ "$failed" -ne 0 ]; then
  echo "check:apis failed. See the ADK rules in AGENTS.md." >&2
  exit 1
fi
echo "check:apis passed"
