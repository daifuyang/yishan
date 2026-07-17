#!/bin/bash
# 认证模块测试

run_tests() {
    echo ""
    echo "=== Auth 模块 ==="

    # 公开接口
    test_api "GET" "/api/health" "Health check"

    # 认证接口
    test_api "GET" "/api/v1/auth/me" "Get current user"

    # 注意：不测试 refresh token，因为刷新会吊销当前 access token
    # 刷新 token 应在所有其他测试完成后单独进行
}
