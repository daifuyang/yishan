#!/usr/bin/env bash
# 在服务器上执行：校验新 release、切换软链接、重启、健康检查，失败自动回滚。
# 用法: bash /opt/yishan/bin/release.sh <timestamp>
set -euo pipefail

ROOT=/opt/yishan
TS="${1:?Usage: release.sh <timestamp>}"
NEW="$ROOT/releases/$TS"
PREV="$(readlink -f "$ROOT/current" 2>/dev/null || true)"

log() { echo "[release $TS] $*"; }

[ -d "$NEW" ] || { echo "release dir missing: $NEW" >&2; exit 1; }
[ -f "$NEW/dist/main.js" ] || { echo "missing dist/main.js" >&2; exit 1; }
[ -f "$NEW/.yishan-api-artifact.json" ] || { echo "missing artifact marker" >&2; exit 1; }

# uploads 必须指向 release 目录之外的 shared/uploads，否则回滚/清理会丢用户文件。
if [ ! -L "$NEW/public/uploads" ]; then
  mkdir -p "$NEW/public"
  ln -sfn "$ROOT/shared/uploads" "$NEW/public/uploads"
fi
mkdir -p "$ROOT/shared/uploads"

rollback() {
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    log "health check failed, rolling back to $PREV"
    ln -sfn "$PREV" "$ROOT/current"
    sudo systemctl restart yishan-api
  else
    log "health check failed and no previous release to roll back to"
  fi
  exit 1
}

ln -sfn "$NEW" "$ROOT/current"
log "switched current -> $NEW"
sudo systemctl restart yishan-api

for i in $(seq 1 15); do
  # 先把响应体取到变量再匹配：curl | grep -q 会让 grep 提前关闭管道，
  # curl 收到 SIGPIPE 以 23 退出，pipefail 会把已经成功的判定判为失败。
  body="$(curl -fsS --max-time 4 http://127.0.0.1:3000/api/health 2>/dev/null || true)"
  if [ "${body#*\"status\":\"ok\"}" != "$body" ]; then
    log "healthy"
    # 当前版本之外只保留最近 2 个历史版本，避免磁盘无限增长。
    # 当前版本和上一个版本（rollback 的落点）都必须排除：
    # cp -a / tar 解包会保留 mtime，ls -1dt 并不保证 NEW 排第一，
    # 只判断 "$old = $NEW/" 的话，上一个版本可能被当成最旧的删掉 ——
    # 那正是下一次发布失败时唯一的回滚去处。
    ls -1dt "$ROOT"/releases/*/ | tail -n +3 | while read -r old; do
      [ "$old" = "$NEW/" ] && continue
      [ -n "$PREV" ] && [ "$old" = "$PREV/" ] && continue
      rm -rf "$old"
    done
    exit 0
  fi
  sleep 2
done

echo "health check did not pass within 90s" >&2
sudo journalctl -u yishan-api --no-pager -n 40 >&2 || true
rollback
