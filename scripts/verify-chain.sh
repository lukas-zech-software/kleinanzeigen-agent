#!/usr/bin/env bash
# Verifies the invariants of the tutorial's chapter chain.
# Usage: scripts/verify-chain.sh [branch ...]
# Without arguments the full chain below is checked, in order.
set -euo pipefail

CHAIN=(main chapter-01-starter chapter-01-solution)
if [ "$#" -gt 0 ]; then
  CHAIN=("$@")
fi

fail() {
  echo "FAIL [$1] $2" >&2
  exit 1
}

repo_root=$(git rev-parse --show-toplevel)
# Pathspecs below are relative to the repository root, whatever the caller's directory.
cd "$repo_root"
tmp=$(mktemp -d)
cleanup() {
  for dir in "$tmp"/*; do
    if [ -d "$dir" ]; then
      git -C "$repo_root" worktree remove --force "$dir" >/dev/null 2>&1 || true
    fi
  done
  rm -rf "$tmp"
}
trap cleanup EXIT

for branch in "${CHAIN[@]}"; do
  git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null ||
    fail "$branch" "branch does not exist"
done

# Invariant 1: each branch is an ancestor of the next.
for ((i = 1; i < ${#CHAIN[@]}; i++)); do
  previous=${CHAIN[i - 1]}
  current=${CHAIN[i]}
  git merge-base --is-ancestor "$previous" "$current" ||
    fail "$current" "invariant 1: $previous is not an ancestor"
done

for branch in "${CHAIN[@]}"; do
  number=
  case "$branch" in
    chapter-*-starter | chapter-*-solution)
      number=${branch#chapter-}
      number=${number%%-*}
      kind=${branch##*-}

      # Invariant 4: the chapter marker matches the branch name.
      marker=$(git show "$branch:.tutorial/chapter" 2>/dev/null | tr -d '[:space:]' || true)
      [ "$marker" = "$number" ] ||
        fail "$branch" "invariant 4: .tutorial/chapter is '$marker', expected '$number'"

      # Invariant 5: CURRENT_CHAPTER.md describes this chapter.
      heading=$(git show "$branch:CURRENT_CHAPTER.md" 2>/dev/null | sed -n 1p || true)
      case "$heading" in
        "# Chapter $((10#$number)):"*) ;;
        *) fail "$branch" "invariant 5: CURRENT_CHAPTER.md starts with '$heading', expected '# Chapter $((10#$number)): …'" ;;
      esac

      # Invariant 3: a solution has no TODO left for its own chapter.
      if [ "$kind" = solution ] && git grep -q "TODO(ch$number-" "$branch" -- src scripts; then
        fail "$branch" "invariant 3: TODO(ch$number-…) markers remain"
      fi
      ;;
  esac

  worktree="$tmp/$branch"
  git worktree add --detach --quiet "$worktree" "$branch"
  (cd "$worktree" && npm ci --silent >/dev/null 2>&1) ||
    fail "$branch" "npm ci failed"

  # Invariants 2 and 3: a chapter branch typechecks.
  if [ -n "$number" ]; then
    (cd "$worktree" && npx tsc --noEmit) ||
      fail "$branch" "invariant 2: tsc --noEmit failed"
  fi

  # Invariant 7: a solution passes its offline test, without an API key.
  if [ -n "$number" ] && [ "$kind" = solution ]; then
    (cd "$worktree" &&
      env -u GEMINI_API_KEY -u GOOGLE_API_KEY -u GOOGLE_GENAI_API_KEY \
        npm run test:offline --if-present --silent) ||
      fail "$branch" "invariant 7: npm run test:offline failed"
  fi

  # Invariant 8: no banned API, and one ADK version in package.json, node_modules and the guides.
  (cd "$worktree" && npm run check:apis --silent >/dev/null && npm run check:adk-version --silent >/dev/null) ||
    fail "$branch" "invariant 8: npm run check:apis or npm run check:adk-version failed"

  # Invariant 6: every branch is formatted with Prettier.
  (cd "$worktree" && npx prettier --check --log-level warn .) ||
    fail "$branch" "invariant 6: prettier --check failed, run 'npm run format'"
  echo "ok   [$branch]"
done

echo "OK: chain verified (${CHAIN[*]})"
