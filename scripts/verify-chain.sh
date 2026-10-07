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
  case "$branch" in
    chapter-*-starter | chapter-*-solution) ;;
    *) continue ;;
  esac
  number=${branch#chapter-}
  number=${number%%-*}
  kind=${branch##*-}

  # Invariant 4: the chapter marker matches the branch name.
  marker=$(git show "$branch:.tutorial/chapter" 2>/dev/null | tr -d '[:space:]' || true)
  [ "$marker" = "$number" ] ||
    fail "$branch" "invariant 4: .tutorial/chapter is '$marker', expected '$number'"

  # Invariant 3: a solution has no TODO left for its own chapter.
  if [ "$kind" = solution ] && git grep -q "TODO(ch$number-" "$branch" -- src scripts; then
    fail "$branch" "invariant 3: TODO(ch$number-…) markers remain"
  fi

  # Invariants 2 and 3: the branch typechecks.
  worktree="$tmp/$branch"
  git worktree add --detach --quiet "$worktree" "$branch"
  (cd "$worktree" && npm ci --silent >/dev/null 2>&1) ||
    fail "$branch" "npm ci failed"
  (cd "$worktree" && npx tsc --noEmit) ||
    fail "$branch" "invariant 2: tsc --noEmit failed"
  echo "ok   [$branch]"
done

echo "OK: chain verified (${CHAIN[*]})"
