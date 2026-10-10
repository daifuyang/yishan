#!/bin/bash
# Admin - 系统管理模块测试

run_tests() {
    echo ""
    echo "=== Admin System 模块 ==="

    # 插件管理
    test_api "GET" "/api/v1/admin/system/plugins/" "List plugins"
    test_api "GET" "/api/v1/admin/system/plugins/hooks/reports" "Plugin hooks reports"

    # 登录日志
    test_api "GET" "/api/v1/admin/system/login-logs/" "List login logs"
    test_api "GET" "/api/v1/admin/system/login-logs/1" "Get login log detail"

    # 地区管理
    test_api "GET" "/api/v1/admin/system/regions/" "List regions"
    test_api "GET" "/api/v1/admin/system/regions/tree" "Region tree"
    test_api "GET" "/api/v1/admin/system/regions/110000" "Get region detail (北京)"

    # 系统参数（需要传入 key 参数）
    test_api "GET" "/api/v1/admin/system/options/site_name" "Get system option"

    # Token 统计
    test_api "GET" "/api/v1/system/token-stats" "Token stats"
}
