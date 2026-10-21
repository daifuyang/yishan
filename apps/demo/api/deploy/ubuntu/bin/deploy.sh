#!/usr/bin/env bash
# yishan 演示环境（腾讯云 Ubuntu）的**受控部署执行器**。
#
# 它是 CI 部署账号（deployer）在目标机上唯一能做的事。deployer 的公钥在
# authorized_keys 里被强制命令钉死成 `sudo -n /opt/yishan/bin/deploy.sh`，
# 所以这把私钥泄露的后果，不是"拿到一台机器的 shell"，而是"能把某个已签名
# 产物发布到演示环境"——权限被压到刚好够用。
#
# 部署请求通过 SSH_ORIGINAL_COMMAND 传进来（一行，空白分隔的字段），
# 所以这里必须**严格解析**：只认白名单动词，参数逐个按正则校验，
# 任何不符合的一律拒绝。不做 eval，不把参数拼进 shell 命令行。
#
# 用法（只应由 CI 通过 ssh 调用）：
#   fetch   <asset> <url_base64> <sha256>   从七牛拉产物并校验
#   unpack  <release_ts> <commit_sha>       解包到 releases/<ts>
#   migrate <release_ts>                    执行数据库迁移
#   release <release_ts>                    切软链 + 重启 + 健康检查（失败自动回滚）
#   h5-unpack <release_ts> <commit_sha>     解包 H5 到 h5/<ts>
#   h5-release <release_ts>                 切 h5-current + 内容健康检查（失败自动回滚）
#   cleanup <commit_sha>                    删除 incoming 里的上传包
#   version                                 打印脚本版本
#
# 安装（目标机上，root）：
#   install -o root -g root -m 0755 deploy.sh /opt/yishan/bin/deploy.sh
#   install -o root -g root -m 0755 release-h5.sh /opt/yishan/bin/release-h5.sh
set -euo pipefail

VERSION="20261021-1"
ROOT=/opt/yishan
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

log() { echo "[deploy] $*"; }
audit() { logger -t yishan-deploy -- "$*" 2>/dev/null || true; }

die() {
  echo "[deploy] ERROR: $*" >&2
  audit "DENIED: $*"
  exit 1
}

# ---------------------------------------------------------------------------
# 严格解析 SSH_ORIGINAL_COMMAND
# ---------------------------------------------------------------------------

CMD="${SSH_ORIGINAL_COMMAND:-}"
[ -n "$CMD" ] || die "empty command"

# 整体形状：动词 + 若干空白分隔的参数。先用一条正则把"含元字符"和"未知动词"
# 挡在外面，再逐个按动词校验参数。
case "$CMD" in
  fetch\ *|unpack\ *|migrate\ *|release\ *|cleanup\ *|h5-unpack\ *|h5-release\ *|version|version\ *)
    ;;
  *)
    die "unsupported command: ${CMD%% *}"
    ;;
esac

# read -r -a 按 IFS（空格/制表）切分；不使用 glob 展开。
IFS=' ' read -r -a ARGS <<<"$CMD"
ACTION="${ARGS[0]:-}"
set -- "${ARGS[@]:1}"

# 用法：need_args <期望个数> <实际个数>
need_args() {
  local want="$1" got="$2"
  [ "$got" -eq "$want" ] || die "$ACTION expects $want argument(s), got $got"
}

# 只允许字母数字、点、横线、下划线（文件名/时间戳/短哈希）
SAFE_NAME='^[A-Za-z0-9._-]+$'
# 时间戳形如 20261020-073144
SAFE_TS='^[0-9]{8}-[0-9]{6}$'
# git commit sha
SAFE_SHA='^[0-9a-f]{40}$'
# sha256
SAFE_SHA256='^[0-9a-f]{64}$'
# base64（可能带 = 填充）
SAFE_B64='^[A-Za-z0-9+/=]+$'

# ---------------------------------------------------------------------------
# 动词实现
# ---------------------------------------------------------------------------

cmd_version() {
  echo "$VERSION"
}

cmd_fetch() {
  need_args 3 "$#"
  local asset="$1" url_b64="$2" sha256="$3"
  [[ "$asset"  =~ $SAFE_NAME  ]] || die "bad asset name"
  [[ "$url_b64" =~ $SAFE_B64   ]] || die "bad url encoding"
  [[ "$sha256" =~ $SAFE_SHA256 ]] || die "bad sha256"

  local url
  url="$(printf '%s' "$url_b64" | base64 -d)" || die "url is not valid base64"
  # 只允许 https：否则 file:// 之类会让 curl 把本机文件当产物下载下来。
  case "$url" in
    https://*) ;;
    *) die "url must be https" ;;
  esac

  local dir="$ROOT/incoming"
  mkdir -p "$dir"
  cd "$dir"

  log "downloading $asset"
  curl -fSL --retry 5 --retry-delay 5 --retry-all-errors --connect-timeout 20 \
    -o "$asset" "$url"

  # 用 sha256 校验而不是比大小：比大小只能发现截断，发现不了内容损坏。
  echo "$sha256  $asset" | sha256sum -c - || die "sha256 mismatch for $asset"
  ls -l "$asset"
  audit "fetch $asset ok"
}

cmd_unpack() {
  need_args 2 "$#"
  local ts="$1" sha="$2"
  [[ "$ts"  =~ $SAFE_TS  ]] || die "bad release ts"
  [[ "$sha" =~ $SAFE_SHA ]] || die "bad commit sha"

  local dest="$ROOT/releases/$ts"
  local tarball="$ROOT/incoming/yishan-api-$sha.tar.gz"
  [ -f "$tarball" ] || die "missing $tarball"

  rm -rf "$dest"
  mkdir -p "$dest"
  tar -xzf "$tarball" -C "$dest" --strip-components=1
  [ -f "$dest/dist/main.js" ] || die "dist/main.js missing after unpack"
  log "unpacked into $dest"
  audit "unpack $ts ok"
}

cmd_migrate() {
  need_args 1 "$#"
  local ts="$1"
  [[ "$ts" =~ $SAFE_TS ]] || die "bad release ts"

  local dest="$ROOT/releases/$ts"
  [ -d "$dest" ] || die "missing release dir $dest"
  cd "$dest"

  # 必须钉死 node 版本。目标机的交互式 shell 走 nvm，PATH 上的 node 是
  # v24.19.0；而 systemd 单元 ExecStart 用的是 /usr/local/lib/nodejs 下的
  # v22.22.1。直接写 `node` 会用 24 跑迁移，和线上运行时不是同一个版本。
  local node_bin=""
  local candidate
  for candidate in \
    /usr/local/lib/nodejs/node-v22.22.1-linux-x64/bin/node \
    "$(command -v node 2>/dev/null || true)" \
    /usr/local/bin/node /usr/bin/node; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then node_bin="$candidate"; break; fi
  done
  [ -n "$node_bin" ] || die "no usable node binary found on the host"
  log "using node: $node_bin ($("$node_bin" -v))"

  # 环境变量复用 systemd 同源的 shared/.env，不给仓库新增任何凭据。
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/shared/.env"
  set +a

  "$node_bin" dist/scripts/migrate.js --dry-run
  "$node_bin" dist/scripts/migrate.js --apply
  # 再确认一次：仍有 pending 说明没迁干净，不允许继续发布代码。
  if "$node_bin" dist/scripts/migrate.js --dry-run 2>&1 | grep -qE '[1-9][0-9]* pending'; then
    die "migrations still pending after --apply"
  fi
  log "migrations up to date in $dest"
  audit "migrate $ts ok"
}

cmd_release() {
  need_args 1 "$#"
  local ts="$1"
  [[ "$ts" =~ $SAFE_TS ]] || die "bad release ts"
  log "switching release $ts"
  bash "$ROOT/bin/release.sh" "$ts"
  audit "release $ts ok"
}

cmd_h5_unpack() {
  need_args 2 "$#"
  local ts="$1" sha="$2"
  [[ "$ts"  =~ $SAFE_TS  ]] || die "bad release ts"
  [[ "$sha" =~ $SAFE_SHA ]] || die "bad commit sha"

  # 和 API 解包分开目录：h5/ 只放静态产物，绝不能和 releases/ 混在一起
  # —— nginx 的 root 是 h5-current，release.sh 又按 releases/ 清理历史版本，
  # 混了会让两边的清理逻辑互相删错东西。
  local dest="$ROOT/h5/$ts"
  local tarball="$ROOT/incoming/yishan-h5-$sha.tar.gz"
  [ -f "$tarball" ] || die "missing $tarball"

  rm -rf "$dest"
  mkdir -p "$dest"
  tar -xzf "$tarball" -C "$dest" --strip-components=1
  [ -f "$dest/index.html" ] || die "index.html missing after unpack"
  log "unpacked h5 into $dest"
  audit "h5-unpack $ts ok"
}

cmd_h5_release() {
  need_args 1 "$#"
  local ts="$1"
  [[ "$ts" =~ $SAFE_TS ]] || die "bad release ts"
  log "switching h5 release $ts"
  bash "$ROOT/bin/release-h5.sh" "$ts"
  audit "h5-release $ts ok"
}

cmd_cleanup() {
  need_args 1 "$#"
  local sha="$1"
  [[ "$sha" =~ $SAFE_SHA ]] || die "bad commit sha"
  # API 与 H5 共用同一个 cleanup 动词：两条流水线的产物都按 commit sha 命名，
  # 一次清理把两边都带走，免得为一条 tar 包再开一个动词。
  rm -f "$ROOT/incoming/yishan-api-$sha.tar.gz"         "$ROOT/incoming/yishan-h5-$sha.tar.gz"
  audit "cleanup $sha ok"
}

case "$ACTION" in
  fetch)      cmd_fetch      "$@" ;;
  unpack)     cmd_unpack     "$@" ;;
  migrate)    cmd_migrate    "$@" ;;
  release)    cmd_release    "$@" ;;
  h5-unpack)  cmd_h5_unpack  "$@" ;;
  h5-release) cmd_h5_release "$@" ;;
  cleanup)    cmd_cleanup    "$@" ;;
  version)    cmd_version    "$@" ;;
  *)          die "unsupported command: $ACTION" ;;
esac
