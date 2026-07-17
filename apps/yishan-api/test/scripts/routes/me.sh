#!/bin/bash
# Me - 当前用户模块测试

run_tests() {
    echo ""
    echo "=== Me 模块 ==="

    # API Token 管理
    test_api "GET" "/api/v1/me/api-tokens/" "List my API tokens"

    # 创建 PAT
    local pat_resp
    pat_resp=$(test_api_raw "POST" "/api/v1/me/api-tokens/" '{
        "name":"E2E Test Token",
        "scopes":["*"],
        "expiresAt":null
    }')
    local pat_id=$(echo "$pat_resp" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

    if [ -n "$pat_id" ]; then
        test_api "GET" "/api/v1/me/api-tokens/${pat_id}" "Get created PAT"
        test_api "DELETE" "/api/v1/me/api-tokens/${pat_id}" "Delete PAT"
    else
        log_warn "跳过 PAT CRUD 测试（创建失败）"
    fi
}
