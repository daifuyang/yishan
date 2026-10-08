#!/usr/bin/env bash
# Run the repository's existing check commands and record exit code + duration per step.
# Usage: bash run-checks.sh <repo-root> <log-dir> <step-id>...
# Optional: P0_NODE_DIR=<dir containing node 22.22.1 + pnpm 8.15.9> (prepended to PATH)
set -u
ROOT="$1"; shift
LOGDIR="$1"; shift
[ -n "${P0_NODE_DIR:-}" ] && export PATH="$P0_NODE_DIR:$PATH"
mkdir -p "$LOGDIR"
SUMMARY="$LOGDIR/summary.tsv"
cd "$ROOT" || exit 1

declare -A CMD=(
  [tiptap-build]="pnpm --filter yishan-tiptap build"
  [ci-gen-plugin-routes]="pnpm --filter yishan-admin gen:plugin-routes"
  [admin-setup]="pnpm --filter yishan-admin exec max setup"
  [admin-lint]="pnpm --filter yishan-admin lint"
  [admin-test]="pnpm --filter yishan-admin test"
  [admin-build]="pnpm --filter yishan-admin build"
  [api-build]="pnpm --filter yishan-api build:ts"
  [api-test]="pnpm --filter yishan-api test"
  [app-lint]="pnpm --filter yishan-app lint"
  [app-build]="pnpm --filter yishan-app build:weapp"
  [docs-typecheck]="pnpm --filter yishan-docs typecheck"
  [docs-build]="pnpm --filter yishan-docs build"
  [module-naming]="node scripts/check-module-naming.mjs"
  [main-baseline]="node scripts/check-main-baseline.mjs"
  [test-scripts]="pnpm test:scripts"
  [check-openapi]="pnpm check:openapi"
  [root-lint]="pnpm lint"
  [root-test]="pnpm test"
  [root-build]="pnpm build"
)

for step in "$@"; do
  cmd="${CMD[$step]:-}"
  if [ -z "$cmd" ]; then echo "unknown step $step"; continue; fi
  log="$LOGDIR/$step.log"
  start=$(date +%s)
  echo "\$ $cmd" > "$log"
  bash -c "$cmd" >> "$log" 2>&1
  code=$?
  dur=$(( $(date +%s) - start ))
  echo "EXIT=$code DURATION=${dur}s" >> "$log"
  printf '%s\t%s\t%ss\t%s\n' "$step" "$code" "$dur" "$cmd" | tee -a "$SUMMARY"
done
