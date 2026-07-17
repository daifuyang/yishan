#!/bin/bash
# Yishan API 端到端测试脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

echo ""
echo "=============================================="
echo "      Yishan API End-to-End Test Suite"
echo "=============================================="
echo ""

# 0. 预检
check_api || exit 1

# 1. 登录
do_login || exit 1

# ============================================
# Phase 1: 公开接口测试
# ============================================
echo ""
echo "=== Phase 1: Public Endpoints ==="
test_api "GET" "/api/health" "Health check"

# ============================================
# Phase 2: 认证接口测试
# ============================================
echo ""
echo "=== Phase 2: Auth Endpoints ==="
test_api "GET" "/api/v1/auth/me" "Get current user"

# 测试刷新 token
if [ -n "$REFRESH_TOKEN" ]; then
    test_api "POST" "/api/v1/auth/refresh" "Refresh token" "200" "{\"refreshToken\":\"$REFRESH_TOKEN\"}"
fi

# ============================================
# Phase 3: Admin - Users
# ============================================
echo ""
echo "=== Phase 3: Admin Users ==="
test_api "GET" "/api/v1/admin/users/" "List users"
test_api "GET" "/api/v1/admin/users/1" "Get user detail (id=1)"

# 创建测试用户
TEST_USER_RESP=$(test_api_raw "POST" "/api/v1/admin/users/" '{"username":"testuser_e2e","password":"Test123456","email":"e2e@test.com","phone":"13800000001","realName":"E2E Test User"}')
TEST_USER_ID=$(echo "$TEST_USER_RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$TEST_USER_ID" ]; then
    test_api "GET" "/api/v1/admin/users/${TEST_USER_ID}" "Get created user detail"
    test_api "PUT" "/api/v1/admin/users/${TEST_USER_ID}" "Update user" "200" '{"realName":"Updated E2E"}'
    test_api "DELETE" "/api/v1/admin/users/${TEST_USER_ID}" "Delete user"
else
    log_warn "跳过用户 CRUD 测试（创建失败）"
fi

# ============================================
# Phase 4: Admin - Roles
# ============================================
echo ""
echo "=== Phase 4: Admin Roles ==="
test_api "GET" "/api/v1/admin/roles/" "List roles"
test_api "GET" "/api/v1/admin/roles/1" "Get role detail (id=1)"

# ============================================
# Phase 5: Admin - Menus
# ============================================
echo ""
echo "=== Phase 5: Admin Menus ==="
test_api "GET" "/api/v1/admin/menus/" "List menus"
test_api "GET" "/api/v1/admin/menus/tree" "Menu tree"
test_api "GET" "/api/v1/admin/menus/tree/authorized" "Authorized menu tree"
test_api "GET" "/api/v1/admin/menus/paths/authorized" "Authorized menu paths"

# ============================================
# Phase 6: Admin - Departments
# ============================================
echo ""
echo "=== Phase 6: Admin Departments ==="
test_api "GET" "/api/v1/admin/departments/" "List departments"
test_api "GET" "/api/v1/admin/departments/tree" "Department tree"

# ============================================
# Phase 7: Admin - Dicts
# ============================================
echo ""
echo "=== Phase 7: Admin Dicts ==="
test_api "GET" "/api/v1/admin/dicts/types" "List dict types"
test_api "GET" "/api/v1/admin/dicts/data" "List dict data"
test_api "GET" "/api/v1/admin/dicts/data/map" "Dict data map"

# ============================================
# Phase 8: Admin - Attachments
# ============================================
echo ""
echo "=== Phase 8: Admin Attachments ==="
test_api "GET" "/api/v1/admin/attachments/folders" "List folders"
test_api "GET" "/api/v1/admin/attachments/folders/tree" "Folder tree"
test_api "GET" "/api/v1/admin/attachments/" "List attachments"

# ============================================
# Phase 9: Admin - System
# ============================================
echo ""
echo "=== Phase 9: Admin System ==="
test_api "GET" "/api/v1/admin/system/plugins/" "List plugins"
test_api "GET" "/api/v1/admin/system/login-logs/" "List login logs"
test_api "GET" "/api/v1/admin/system/regions/" "List regions"
test_api "GET" "/api/v1/admin/system/regions/tree" "Region tree"

# ============================================
# Phase 10: App Endpoints
# ============================================
echo ""
echo "=== Phase 10: App Endpoints ==="
test_api "GET" "/api/v1/app/menus/authorized" "App authorized menus"
test_api "GET" "/api/v1/app/dicts/" "App dicts"
test_api "GET" "/api/v1/app/contacts/depts/tree" "App contacts dept tree"
test_api "GET" "/api/v1/app/dashboard/stats" "App dashboard stats"

# ============================================
# Phase 11: Me Endpoints
# ============================================
echo ""
echo "=== Phase 11: Me Endpoints ==="
test_api "GET" "/api/v1/me/api-tokens/" "List my API tokens"

# 创建 PAT
PAT_RESP=$(test_api_raw "POST" "/api/v1/me/api-tokens/" '{"name":"E2E Test Token","scopes":["*"]}')
PAT_ID=$(echo "$PAT_RESP" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$PAT_ID" ]; then
    test_api "GET" "/api/v1/me/api-tokens/${PAT_ID}" "Get created PAT"
    test_api "DELETE" "/api/v1/me/api-tokens/${PAT_ID}" "Delete PAT"
else
    log_warn "跳过 PAT CRUD 测试（创建失败）"
fi

# ============================================
# Cleanup
# ============================================
echo ""
echo "=== Cleanup ==="
do_logout

# ============================================
# 报告
# ============================================
print_report
