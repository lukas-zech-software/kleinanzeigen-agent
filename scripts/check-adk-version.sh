#!/usr/bin/env bash
# Fails when the installed ADK, package.json, and the vendored guides disagree about the version.
# Usage: scripts/check-adk-version.sh
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

fail() {
  echo "FAIL $1" >&2
  exit 1
}

version_of() {
  node -p "require('./node_modules/$1/package.json').version" 2>/dev/null ||
    fail "$1 is not installed. Run 'npm ci'."
}

declared() {
  node -p "const p = require('./package.json'); (p.dependencies ?? {})['$1'] ?? (p.devDependencies ?? {})['$1'] ?? ''"
}

adk=$(version_of @google/adk)
devtools=$(version_of @google/adk-devtools)
declared_adk=$(declared @google/adk)
declared_devtools=$(declared @google/adk-devtools)
guides=$(sed -n 's/^adk=//p' docs/reference/adk-js-guides/VERSION 2>/dev/null || true)

[ "$declared_adk" = "$adk" ] ||
  fail "package.json asks for @google/adk '$declared_adk', installed is $adk. Pin the exact version and run 'npm install'."
[ "$declared_devtools" = "$devtools" ] ||
  fail "package.json asks for @google/adk-devtools '$declared_devtools', installed is $devtools. Pin the exact version and run 'npm install'."
[ "$devtools" = "$adk" ] ||
  fail "@google/adk is $adk and @google/adk-devtools is $devtools. They must be the same version."
[ "$guides" = "$adk" ] ||
  fail "The guides in docs/reference/adk-js-guides were checked against ADK '$guides', installed is $adk. Run scripts/update-adk-guides.sh and review SOURCE.md."

echo "check:adk-version passed (ADK $adk)"
