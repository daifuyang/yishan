#!/usr/bin/env bash
# Replays .github/workflows/yishan-fullstack-ci.yml steps locally against the temp containers.
# Each step's exit code is recorded; execution continues so all results are visible.
set -u
export PATH="<node-22.22.1-dir>:$PATH"
ROOT="<repo>"
LOG="$ROOT/tmp/p1a/logs/ci-local"
mkdir -p "$LOG"; : > "$LOG/summary.tsv"
cd "$ROOT" || exit 1
docker exec yishan-p1a-mysql mysql -uroot -p<temp-root-password> -e "DROP DATABASE IF EXISTS yishan_ci; CREATE DATABASE yishan_ci" 2>&1 | grep -v Warning
export YISHAN_BASELINE_TARGET=main
export DATABASE_URL=mysql://root:<temp-root-password>@127.0.0.1:33797/yishan_ci
export REDIS_URL=redis://127.0.0.1:36797/3
export JWT_SECRET=ci-only-jwt-secret-not-used-anywhere-else-0123456789
RUNNER_TEMP="$ROOT/tmp/p1a/runner"; mkdir -p "$RUNNER_TEMP"

step() {
  local name="$1"; shift
  local start=$(date +%s)
  ( "$@" ) > "$LOG/$name.log" 2>&1
  local code=$?
  printf '%s\t%s\t%ss\n' "$name" "$code" "$(( $(date +%s) - start ))" | tee -a "$LOG/summary.tsv"
}

step toolchain pnpm check:toolchain
step install pnpm install --frozen-lockfile
step tiptap-build pnpm --filter yishan-tiptap build
step admin-setup pnpm --filter yishan-admin exec max setup
step lint pnpm lint
step script-tests pnpm test:scripts
step admin-test pnpm --filter yishan-admin test
step admin-build pnpm --filter yishan-admin build
step api-build pnpm --filter yishan-api build:ts
step api-test pnpm --filter yishan-api test
step app-build pnpm --filter yishan-app build:weapp
step docs-build pnpm --filter yishan-docs build

core_schema() {
  cd apps/yishan-api || return 1
  pnpm db:generate || return 1
  local generated; generated="$(ls drizzle/*.sql | grep -v '/0000_init.sql$')"
  test "$(echo "$generated" | wc -l)" -eq 1 || return 1
  diff -q --strip-trailing-cr "$generated" drizzle/0000_init.sql; local rc=$?
  echo "generated=$generated"
  return $rc
}
step core-schema-drift core_schema

migrate_ci_db() {
  cd apps/yishan-api || return 1
  for dir in src/modules/*/; do
    if node --input-type=module -e "import { isPackedModuleDir } from './scripts/module-pack.mjs'; process.exit(isPackedModuleDir('$dir') ? 0 : 1)"; then
      (cd "$dir" && ../../../node_modules/.bin/drizzle-kit --config=./drizzle.config.ts migrate) || return 1
    fi
  done
  pnpm db:migrate
}
step migrate-ci-db migrate_ci_db
step module-tables node apps/yishan-api/scripts/check-module-tables.mjs
step dump-openapi node apps/yishan-api/scripts/dump-openapi-from-build.mjs "$RUNNER_TEMP/openapi.runtime.json"
step check-openapi pnpm check:openapi "$RUNNER_TEMP/openapi.runtime.json"
step contract-vs-p0 node scripts/openapi-diff.mjs docs/verification/yishan-source-first-p0/evidence/openapi/main-6a5c62a-development.json "$RUNNER_TEMP/openapi.runtime.json" --allow scripts/baselines/openapi-allowed-changes.json

# Locally the regenerated client is not committed yet, so compare against a snapshot of the working copy
# (CI compares against the commit with `git diff --exit-code`).
client_consistency() {
  rm -rf "$RUNNER_TEMP/generated-before" && cp -r apps/yishan-admin/src/services/generated "$RUNNER_TEMP/generated-before"
  pnpm --filter yishan-admin openapi || return 1
  diff -r --strip-trailing-cr "$RUNNER_TEMP/generated-before" apps/yishan-admin/src/services/generated
}
step generated-client client_consistency

integration() {
  YISHAN_RUN_INTEGRATION=1 YISHAN_TEST_MYSQL_URL=mysql://root:<temp-root-password>@127.0.0.1:33797/yishan_it YISHAN_TEST_REDIS_URL=redis://127.0.0.1:36797/1 pnpm --filter yishan-api test:integration
}
step integration integration

# cleanup only what this script generated / created
rm -f apps/yishan-api/drizzle/0000_[!i]*.sql
rm -rf apps/yishan-api/drizzle/meta
docker exec yishan-p1a-mysql mysql -uroot -p<temp-root-password> -e "DROP DATABASE IF EXISTS yishan_ci" 2>&1 | grep -v Warning
