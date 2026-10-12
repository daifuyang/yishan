#!/bin/bash
# Admin - 角色管理模块测试

run_tests() {
    echo ""
    echo "=== Admin Roles 模块 ==="

    test_api "GET" "/api/v1/admin/roles/" "List roles"
    test_api "GET" "/api/v1/admin/roles/1" "Get role detail (id=1)"

    # 创建角色（使用唯一名称避免重复）
    local role_name="测试角色_$(date +%s)"
    local role_resp
    role_resp=$(test_api_raw "POST" "/api/v1/admin/roles/" "{
        \"name\":\"$role_name\",
        \"code\":\"test_role_$(date +%s)\",
        \"sort\":99,
        \"status\":1,
        \"remark\":\"E2E 测试角色\"
    }")
    local role_id=$(echo "$role_resp" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

    if [ -n "$role_id" ]; then
        test_api "GET" "/api/v1/admin/roles/${role_id}" "Get created role"
        test_api "PUT" "/api/v1/admin/roles/${role_id}" "Update role" "200" "{\"name\":\"更新_$role_name\"}"
        test_api "DELETE" "/api/v1/admin/roles/${role_id}" "Delete role"
    else
        log_warn "跳过角色 CRUD 测试（创建失败）"
    fi
}
