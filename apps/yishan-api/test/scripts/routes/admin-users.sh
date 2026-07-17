#!/bin/bash
# Admin - 用户管理模块测试

run_tests() {
    echo ""
    echo "=== Admin Users 模块 ==="

    # 列表
    test_api "GET" "/api/v1/admin/users/" "List users"
    test_api "GET" "/api/v1/admin/users/1" "Get user detail (id=1)"

    # 创建
    local user_resp
    user_resp=$(test_api_raw "POST" "/api/v1/admin/users/" '{
        "username":"testuser_'"$(date +%s)"'",
        "password":"Test123456",
        "email":"e2e@test.com",
        "phone":"13800000001",
        "realName":"E2E Test User"
    }')
    local user_id=$(echo "$user_resp" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

    if [ -n "$user_id" ]; then
        test_api "GET" "/api/v1/admin/users/${user_id}" "Get created user"
        test_api "PUT" "/api/v1/admin/users/${user_id}" "Update user" "200" '{"realName":"Updated E2E"}'
        test_api "DELETE" "/api/v1/admin/users/${user_id}" "Delete user"
    else
        log_warn "跳过用户 CRUD 测试（创建失败）"
    fi
}
