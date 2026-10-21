#!/usr/bin/env bash
# 在服务器上执行：校验 H5 新版本、切换 h5-current 软链接、健康检查，失败自动回滚。
# 用法: bash /opt/yishan/bin/release-h5.sh <timestamp>
#
# 与 release.sh（API）的关键差别：H5 是纯静态，nginx 直接按软链读目录，
# 所以这里**不重启任何服务** —— 软链一换，下一个请求就读到新版本。
# 代价是"服务在跑"这件事不构成健康信号，因此健康检查只能落在**内容**上：
# 首页必须 200，而且必须引用本次产物里真实存在的文件。
set -euo pipefail

ROOT=/opt/yishan
TS="${1:?Usage: release-h5.sh <timestamp>}"
NEW="$ROOT/h5/$TS"
PREV="$(readlink -f "$ROOT/h5-current" 2>/dev/null || true)"

log() { echo "[release-h5 $TS] $*"; }

[ -d "$NEW" ] || { echo "h5 release dir missing: $NEW" >&2; exit 1; }
[ -f "$NEW/index.html" ] || { echo "missing index.html in $NEW" >&2; exit 1; }

rollback() {
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    log "health check failed, rolling back to $PREV"
    ln -sfn "$PREV" "$ROOT/h5-current"
  else
    log "health check failed and no previous release to roll back to"
  fi
  exit 1
}

ln -sfn "$NEW" "$ROOT/h5-current"
log "switched h5-current -> $NEW"

# 健康检查打本机 nginx（带 Host 走正确的 server 块）。SNI 也要对：
# 不带 --resolve 时 127.0.0.1 会命中默认 server，所以这里把域名钉到 127.0.0.1。
# -k：证书是给 h5.zerocmf.com 签的，本机这次是按 IP 直连，不参与证书链校验。
body="$(curl -ksS --max-time 6 --resolve h5.zerocmf.com:443:127.0.0.1 \
  https://h5.zerocmf.com/ 2>/dev/null || true)"

if [ "${body#*<title>}" = "$body" ]; then
  log "homepage has no <title>, rolling back"
  rollback
fi

# 首页引用的每个本地资源都必须真的在新目录里。这条比"200 就完事"严格：
# 解包不完整（比如 tar 被截断但退出码为 0）时，index.html 照样能返回 200，
# 只是脚本全挂 404 —— 而那正是"页面看着没变化/白屏"最常见的成因。
refs="$(printf '%s' "$body" | grep -oE '(src|href)="[^"]+"' | sed 's/^[a-z]*="//; s/"$//' || true)"
for ref in $refs; do
  case "$ref" in
    http://*|https://*|//*|data:*) continue ;;
  esac
  clean="${ref%%\?*}"                 # 丢掉 ?v= 之类的查询串
  clean="${clean#/}"                  # 相对 h5-current 根目录
  [ -z "$clean" ] && continue
  if [ ! -e "$NEW/$clean" ]; then
    log "homepage references missing file: $ref"
    rollback
  fi
done
log "healthy ($refs refs checked)"

# 当前版本之外只保留最近 2 个历史版本。当前版本和上一个版本（rollback 的落点）
# 都必须排除，和 release.sh 是同一套理由。
ls -1dt "$ROOT"/h5/*/ | tail -n +3 | while read -r old; do
  [ "$old" = "$NEW/" ] && continue
  [ -n "$PREV" ] && [ "$old" = "$PREV/" ] && continue
  rm -rf "$old"
done

exit 0
