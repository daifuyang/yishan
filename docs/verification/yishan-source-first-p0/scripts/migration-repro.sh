#!/usr/bin/env bash
# P0-6 migration reproduction. Runs ONLY against a disposable MySQL container that carries
# the label purpose=yishan-p0-temp. Never point this at a shared, staging or production DB.
#
# Required env:
#   P0_MYSQL_CONTAINER       name of the temporary container (must have label purpose=yishan-p0-temp)
#   P0_MYSQL_ROOT_PASSWORD   root password of that temporary container
# Optional env:
#   P0_MYSQL_PORT (default 33796)   host port bound to 127.0.0.1
#   P0_API_ROOT  (default <repo>/apps/yishan-api; must already be built with `pnpm build:ts`)
#
# Usage: bash migration-repro.sh <scenario>
#   s1-ci-order          core db:migrate (CI order), then each module migrate as onboard does
#   s2-seed              operator path: node dist/scripts/seed/index.js on a fresh DB
#   s2b-seed-shim        s2 with the test-only file:// require shim (observe onboard past the import bug)
#   s3b-seed-shim-rerun  rerun s2b on the same DB (idempotency)
#   s4-modules-first     control: module migrations before core
#   s6-shop-before-portal control: module-vs-module ordering
#   s5-runner-dryrun     infrastructure/migrations/runner.js dry-run against the s2 DB
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../../.." && pwd)"
API="${P0_API_ROOT:-$REPO/apps/yishan-api}"
C="${P0_MYSQL_CONTAINER:?set P0_MYSQL_CONTAINER}"
PW="${P0_MYSQL_ROOT_PASSWORD:?set P0_MYSQL_ROOT_PASSWORD}"
PORT="${P0_MYSQL_PORT:-33796}"
BASE="mysql://root:$PW@127.0.0.1:$PORT"

label="$(docker inspect -f '{{ index .Config.Labels "purpose" }}' "$C" 2>/dev/null)"
if [ "$label" != "yishan-p0-temp" ]; then
  echo "refusing: container '$C' is not labelled purpose=yishan-p0-temp" >&2
  exit 3
fi

unset DATABASE_HOST DATABASE_USER DATABASE_PASSWORD DATABASE_NAME DATABASE_PORT REDIS_URL
export NODE_ENV=development
export JWT_SECRET=p0-temporary-jwt-secret-for-isolated-baseline-only
SHIM="--require $HERE/fileurl-require-shim.cjs"

mkdb() { docker exec "$C" mysql -uroot -p"$PW" -e "DROP DATABASE IF EXISTS \`$1\`; CREATE DATABASE \`$1\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | grep -v Warning; }
inspect() { node "$HERE/db-inspect.cjs" "$BASE/$1" "$API"; }
run() { echo "\$ (cwd=${PWD#$REPO/}) $*"; "$@"; echo "EXIT=$?"; }
kit() { run "$API/node_modules/.bin/drizzle-kit" --config=./drizzle.config.ts migrate; }

case "${1:-}" in
  s1-ci-order)
    DB=p0_s1_ci; mkdb $DB; export DATABASE_URL="$BASE/$DB"
    cd "$API"; run pnpm db:migrate
    echo "---- after core db:migrate"; inspect $DB
    for m in demo portal shop; do cd "$API/src/modules/$m"; kit; done
    echo "---- after module migrations"; inspect $DB ;;
  s2-seed)
    DB=p0_s2_seed; mkdb $DB; export DATABASE_URL="$BASE/$DB"
    cd "$API"; run node dist/scripts/seed/index.js
    echo "---- after db:seed (run 1)"; inspect $DB ;;
  s2b-seed-shim)
    DB=p0_s2b_seed_shim; mkdb $DB; export DATABASE_URL="$BASE/$DB"; export NODE_OPTIONS="$SHIM"
    cd "$API"; run node dist/scripts/seed/index.js
    echo "---- after db:seed with shim (run 1)"; inspect $DB ;;
  s3b-seed-shim-rerun)
    DB=p0_s2b_seed_shim; export DATABASE_URL="$BASE/$DB"; export NODE_OPTIONS="$SHIM"
    cd "$API"; run node dist/scripts/seed/index.js
    echo "---- after db:seed with shim (run 2)"; inspect $DB ;;
  s4-modules-first)
    DB=p0_s4_modfirst; mkdb $DB; export DATABASE_URL="$BASE/$DB"
    for m in demo portal shop; do cd "$API/src/modules/$m"; kit; done
    cd "$API"; run pnpm db:migrate
    echo "---- after modules-first then core"; inspect $DB ;;
  s6-shop-before-portal)
    DB=p0_s6_shop_first; mkdb $DB; export DATABASE_URL="$BASE/$DB"
    for m in shop portal; do cd "$API/src/modules/$m"; kit; done
    echo "---- after shop then portal"; inspect $DB ;;
  s5-runner-dryrun)
    DB=p0_s2_seed; export DATABASE_URL="$BASE/$DB"
    cd "$API"; run node -e "require('./dist/infrastructure/migrations/runner.js').handler({mode:'dry-run'}).then(r=>{console.log(JSON.stringify(r,null,1));process.exit(0)},e=>{console.error('RUNNER ERROR:',e.message);process.exit(1)})" ;;
  *) echo "unknown scenario: ${1:-}"; exit 2 ;;
esac
