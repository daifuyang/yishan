#!/bin/bash
# 公共函数库

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API 配置
API_BASE="${YISHAN_API_BASE:-http://127.0.0.1:3000}"
TIMEOUT="${YISHAN_TIMEOUT:-30}"

# 全局变量
TOKEN=""
REFRESH_TOKEN=""
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# 日志函数
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 测试单个 API
test_api() {
    local method=$1
    local path=$2
    local description=$3
    local expected_status=${4:-200}
    local body=$5

    ((TOTAL_COUNT++))

    # 构造 curl 命令
    local cmd="curl -s -w '\n%{http_code}' -X $method '${API_BASE}${path}'"
    cmd="$cmd -H 'Content-Type: application/json'"
    cmd="$cmd -H 'Accept: application/json'"

    if [ -n "$TOKEN" ]; then
        cmd="$cmd -H 'Authorization: Bearer $TOKEN'"
    fi

    if [ -n "$body" ]; then
        cmd="$cmd -d '$body'"
    fi

    # 执行请求
    local response
    local http_code
    local body_json

    # DELETE 请求特殊处理：不带 Content-Type
    if [ "$method" = "DELETE" ]; then
        response=$(curl -s -w '\n%{http_code}' -X $method "${API_BASE}${path}" \
            -H 'Accept: application/json' \
            ${TOKEN:+-H "Authorization: Bearer $TOKEN"} 2>&1)
    else
        response=$(curl -s -w '\n%{http_code}' -X $method "${API_BASE}${path}" \
            -H 'Content-Type: application/json' \
            -H 'Accept: application/json' \
            ${TOKEN:+-H "Authorization: Bearer $TOKEN"} \
            ${body:+-d "$body"} 2>&1)
    fi

    http_code=$(echo "$response" | tail -n1)
    body_json=$(echo "$response" | sed '$d')

    # 检查响应
    if [ "$http_code" = "$expected_status" ]; then
        local success=$(echo "$body_json" | grep -o '"success":[^,]*' | head -1 | grep -o 'true\|false')
        if [ "$success" = "true" ]; then
            echo -e "  ${GREEN}✓${NC} $description"
            ((PASS_COUNT++))
            return 0
        fi
    fi

    echo -e "  ${RED}✗${NC} $description (HTTP $http_code, expected $expected_status)"
    echo "    Path: $method $path"
    if [ -n "$body" ]; then
        echo "    Body: $body"
    fi
    echo "    Response: ${body_json:0:200}..."
    ((FAIL_COUNT++))
    return 1
}

# 测试 API 并返回响应体（用于提取 ID 等）
test_api_raw() {
    local method=$1
    local path=$2
    local body=$3

    local cmd="curl -s -X $method '${API_BASE}${path}'"
    cmd="$cmd -H 'Content-Type: application/json'"
    cmd="$cmd -H 'Accept: application/json'"

    if [ -n "$TOKEN" ]; then
        cmd="$cmd -H 'Authorization: Bearer $TOKEN'"
    fi

    if [ -n "$body" ]; then
        cmd="$cmd -d '$body'"
    fi

    eval "$cmd" 2>&1
}

# 登录
do_login() {
    local username="${YISHAN_TEST_USERNAME:-admin}"
    local password="${YISHAN_TEST_PASSWORD:-admin123}"

    log_step "登录中..."

    local response
    response=$(curl -s -X POST "${API_BASE}/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}")

    TOKEN=$(echo "$response" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$response" | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)

    if [ -n "$TOKEN" ]; then
        log_info "登录成功，用户: $username"
        return 0
    else
        log_error "登录失败: $response"
        return 1
    fi
}

# 登出
do_logout() {
    log_step "登出中..."

    # logout 接口需要不带 Content-Type
    local response
    response=$(curl -s -w '\n%{http_code}' -X POST "${API_BASE}/api/v1/auth/logout" \
        -H 'Accept: application/json' \
        -H "Authorization: Bearer $TOKEN" 2>&1)

    local http_code=$(echo "$response" | tail -n1)
    local body_json=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ] && echo "$body_json" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✓${NC} Logout"
        ((PASS_COUNT++))
        ((TOTAL_COUNT++))
        return 0
    else
        echo -e "  ${RED}✗${NC} Logout (HTTP $http_code)"
        ((FAIL_COUNT++))
        ((TOTAL_COUNT++))
        return 1
    fi
}

# 检查 API 可用性
check_api() {
    log_step "检查 API 可用性..."

    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/api/health")

    if [ "$http_code" = "200" ]; then
        log_info "API 服务正常 (${API_BASE})"
        return 0
    else
        log_error "API 服务不可用 (HTTP $http_code)"
        return 1
    fi
}

# 打印报告
print_report() {
    echo ""
    echo "========================================"
    echo "           TEST REPORT"
    echo "========================================"
    echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
    echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
    echo -e "Total:  $TOTAL_COUNT"
    echo "========================================"

    if [ $FAIL_COUNT -gt 0 ]; then
        return 1
    fi
    return 0
}
