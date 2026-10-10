#!/bin/bash
# System - 岗位管理模块测试

run_tests() {
    echo ""
    echo "=== System Positions 模块 ==="

    # 岗位列表
    test_api "GET" "/api/v1/admin/positions/" "List posts"

    # 创建岗位（使用唯一名称避免重复）
    local post_name="测试岗位_$(date +%s)"
    local post_resp
    post_resp=$(test_api_raw "POST" "/api/v1/admin/positions/" "{
        \"name\":\"$post_name\",
        \"code\":\"TEST_POST_$(date +%s)\",
        \"sort\":99,
        \"status\":1,
        \"remark\":\"E2E 测试\"
    }")
    local post_id=$(echo "$post_resp" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

    if [ -n "$post_id" ]; then
        test_api "GET" "/api/v1/admin/positions/${post_id}" "Get post detail"
        test_api "PUT" "/api/v1/admin/positions/${post_id}" "Update post" '200' "{\"name\":\"更新_$post_name\"}"
        test_api "DELETE" "/api/v1/admin/positions/${post_id}" "Delete post"
    else
        log_warn "跳过岗位 CRUD 测试（创建失败）"
    fi
}
