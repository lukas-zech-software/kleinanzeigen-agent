#!/usr/bin/env bash
# Replaces the vendored ADK TypeScript guides with the ones from a branch or tag of google/adk-js.
# Usage: scripts/update-adk-guides.sh [ref]     (default: main)
set -euo pipefail

ref=${1:-main}
cd "$(git rev-parse --show-toplevel)"
target=docs/reference/adk-js-guides

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

git clone --quiet --depth 1 --filter=blob:none --sparse --branch "$ref" \
  https://github.com/google/adk-js.git "$tmp/adk-js"
git -C "$tmp/adk-js" sparse-checkout set docs >/dev/null
[ -d "$tmp/adk-js/docs/guides" ] || {
  echo "FAIL '$ref' has no docs/guides folder." >&2
  exit 1
}

commit=$(git -C "$tmp/adk-js" rev-parse --short=10 HEAD)
committed=$(git -C "$tmp/adk-js" log -1 --format=%cs)
adk=$(node -p "require('./node_modules/@google/adk/package.json').version")

# SOURCE.md is written by hand and survives the update.
if [ -f "$target/SOURCE.md" ]; then
  cp "$target/SOURCE.md" "$tmp/SOURCE.md"
fi
rm -rf "$target"
mkdir -p "$target"
cp -R "$tmp/adk-js/docs/guides/." "$target/"
if [ -f "$tmp/adk-js/docs/adk-ts-improvements.md" ]; then
  cp "$tmp/adk-js/docs/adk-ts-improvements.md" "$target/"
fi
if [ -f "$tmp/SOURCE.md" ]; then
  cp "$tmp/SOURCE.md" "$target/SOURCE.md"
fi

printf 'adk=%s\nref=%s\ncommit=%s\ncommitted=%s\n' "$adk" "$ref" "$commit" "$committed" >"$target/VERSION"

echo "Guides updated from google/adk-js@$ref ($commit, $committed), checked against ADK $adk."
echo "Now review $target/SOURCE.md: the list of symbols the guides name and ADK $adk does not export."
