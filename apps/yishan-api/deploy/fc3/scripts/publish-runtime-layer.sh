#!/usr/bin/env bash
# 发布 Runtime Layer：对比当前指纹与 layer-lock.json，
# 不一致（或 lock 不存在）就调 `s cli fc3 layer publish` 发布新版本并写回 lock。
# 一致就直接复用 lock 中的 ARN，跳过发布。
#
# 环境变量：
#   YISHAN_FC_REGION          目标 region，默认 cn-shanghai
#   YISHAN_FC_LAYER_NAME      Layer 名，默认 yishan-api-runtime-layer
#   YISHAN_FC_LAYER_DESC      描述，默认包含 fingerprint
#   YISHAN_FC_ACCESS_ALIAS    s config alias，默认 enterprise
#
# 依赖：apps/yishan-api/deploy/fc3/.build/runtime-layer 已构建
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$FC_DIR/../.." && pwd)"
SOURCE_PACKAGE="$ROOT_DIR/package.json"
LAYER_CONFIG="$FC_DIR/config/layer-dependencies.json"
LOCK_FILE="$FC_DIR/layer-lock.json"
BUILD_DIR="$FC_DIR/.build"

REGION="${YISHAN_FC_REGION:-cn-shanghai}"
LAYER_NAME="${YISHAN_FC_LAYER_NAME:-yishan-api-runtime-layer}"
ACCESS_ALIAS="${YISHAN_FC_ACCESS_ALIAS:-enterprise}"

if [ ! -d "$BUILD_DIR/runtime-layer" ]; then
  echo "❌ 找不到 $BUILD_DIR/runtime-layer，请先跑 build-runtime-layer.sh" >&2
  exit 1
fi

echo "1. 计算当前 Layer 指纹"
CURRENT_FINGERPRINT="$(node "$FC_DIR/scripts/lib/layer-state.cjs" fingerprint "$SOURCE_PACKAGE" "$LAYER_CONFIG" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{console.log(JSON.parse(d).fingerprint)})')"
echo "   current: $CURRENT_FINGERPRINT"

LOCKED_FINGERPRINT=""
if [ -f "$LOCK_FILE" ]; then
  LOCKED_FINGERPRINT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).fingerprint || "")' "$LOCK_FILE")"
  echo "   locked:  $LOCKED_FINGERPRINT"
fi

if [ -n "$LOCKED_FINGERPRINT" ] && [ "$LOCKED_FINGERPRINT" = "$CURRENT_FINGERPRINT" ]; then
  LOCKED_ARN="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).arn || "")' "$LOCK_FILE")"
  if [ -n "$LOCKED_ARN" ]; then
    echo "✅ 指纹一致，复用 lock 中的 ARN：$LOCKED_ARN"
    echo "YISHAN_API_RUNTIME_LAYER_ARN=$LOCKED_ARN"
    exit 0
  fi
fi

if [ -z "$LOCKED_FINGERPRINT" ]; then
  echo "   lock 缺失，需要发布新 Layer"
else
  echo "   指纹不一致，需要发布新 Layer"
fi

DESC="${YISHAN_FC_LAYER_DESC:-Yishan API runtime layer $CURRENT_FINGERPRINT}"

echo "2. 调用 s cli fc3 layer publish"
echo "   region:    $REGION"
echo "   layer:     $LAYER_NAME"
echo "   code:      $BUILD_DIR/runtime-layer"
echo "   runtime:   custom.debian12"
echo "   access:    $ACCESS_ALIAS"

PUBLISH_OUTPUT="$(
  s cli fc3 layer publish \
    --region "$REGION" \
    --layer-name "$LAYER_NAME" \
    --code "$BUILD_DIR/runtime-layer" \
    --compatible-runtime custom.debian12 \
    --description "$DESC" \
    -a "$ACCESS_ALIAS" \
    --output-format json 2>&1
)" || {
  echo "❌ s cli fc3 layer publish 执行失败" >&2
  echo "$PUBLISH_OUTPUT" >&2
  exit 1
}

echo "$PUBLISH_OUTPUT"

# 把 publish 输出落到临时文件，node 从文件读取（heredoc 会占 stdin）
PUBLISH_TMP="$(mktemp)"
printf '%s' "$PUBLISH_OUTPUT" > "$PUBLISH_TMP"
trap 'rm -f "$PUBLISH_TMP"' EXIT

LAYER_ARN="$(
  ACCOUNT_ID="${ALIBABA_CLOUD_ACCOUNT_ID:-}" \
  REGION_HINT="$REGION" \
  LAYER_NAME_HINT="$LAYER_NAME" \
  PUBLISH_FILE="$PUBLISH_TMP" \
  node <<'NODE_EOF'
    const fs = require("node:fs");
    const d = fs.readFileSync(process.env.PUBLISH_FILE, "utf8");
    const accountId = (process.env.ACCOUNT_ID || "").trim();
    const region = process.env.REGION_HINT || "cn-shanghai";
    const layerNameHint = process.env.LAYER_NAME_HINT;

    let version = null;
    let layerName = layerNameHint;
    let regionFromOutput = null;
    let maskedArn = null;

    try {
      const j = JSON.parse(d);
      if (typeof j.version === "number") version = j.version;
      if (j.layerName) layerName = j.layerName;
      const loc = (j && j.code && j.code.location) || "";
      const m = loc.match(/^([a-z0-9-]+)-/);
      if (m) regionFromOutput = m[1];
      const candidates = [j && j.layerVersionArn, j && j.arn, j && j.layer && j.layer.arn, j && j.layerArn, j && j.data && j.data.arn];
      for (const v of candidates) {
        if (typeof v === "string" && v.startsWith("acs:fc:")) {
          maskedArn = v;
          break;
        }
      }
    } catch (_) {}

    if (!maskedArn) {
      const m = d.match(/acs:fc:[^\s"']+/);
      if (m) maskedArn = m[0];
    }
    if (version == null) {
      const m = d.match(/"version"\s*:\s*(\d+)/);
      if (m) version = Number(m[1]);
    }

    if (version == null || !layerName) {
      process.stderr.write("无法从 publish 输出中解析 version / layerName\n");
      process.exit(1);
    }

    const realRegion = regionFromOutput || region;

    if (maskedArn && maskedArn.indexOf("*") === -1) {
      console.log(maskedArn);
      process.exit(0);
    }

    if (!accountId || accountId.indexOf("*") !== -1) {
      process.stderr.write(
        "s cli 返回的 ARN 是脱敏版本（含 *），且 ALIBABA_CLOUD_ACCOUNT_ID 未设置或仍被脱敏。\n" +
        "请设置真实 accountId 后重试：\n" +
        "  export ALIBABA_CLOUD_ACCOUNT_ID=<真实账号 ID>\n" +
        "或在 publish 后手动 record：\n" +
        "  node deploy/fc3/scripts/lib/layer-state.cjs record package.json deploy/fc3/config/layer-dependencies.json deploy/fc3/layer-lock.json '完整 ARN'\n"
      );
      process.exit(2);
    }

    const composed = "acs:fc:" + realRegion + ":" + accountId + ":layers/" + layerName + "/versions/" + version;
    console.log(composed);
NODE_EOF
)" || {
  EXIT=$?
  rm -f "$PUBLISH_TMP"
  if [ $EXIT -eq 2 ]; then
    exit 2
  fi
  echo "❌ 未能从 publish 输出提取 ARN" >&2
  exit 1
}
rm -f "$PUBLISH_TMP"

echo "   published ARN: $LAYER_ARN"

echo "3. 写回 layer-lock.json"
  node "$FC_DIR/scripts/lib/layer-state.cjs" record \
  "$SOURCE_PACKAGE" \
  "$LAYER_CONFIG" \
  "$LOCK_FILE" \
  "$LAYER_ARN"

echo "✅ Layer 发布并记录完成"
echo "YISHAN_API_RUNTIME_LAYER_ARN=$LAYER_ARN"
