#!/bin/bash
# App - 移动端模块测试

run_tests() {
    echo ""
    echo "=== App 模块 ==="

    # 认证
    test_api "GET" "/api/v1/app/auth/me" "App get current user"
    test_api "GET" "/api/v1/app/" "App root"

    # 菜单
    test_api "GET" "/api/v1/app/menus/authorized" "App authorized menus"
    test_api "GET" "/api/v1/app/menus/flatten" "App flatten menus"

    # 字典
    test_api "GET" "/api/v1/app/dicts/" "App dicts"
    test_api "GET" "/api/v1/app/dicts/gender" "App dict by type"

    # 通讯录
    test_api "GET" "/api/v1/app/contacts/depts/tree" "App contacts dept tree"

    # 仪表盘
    test_api "GET" "/api/v1/app/dashboard/stats" "App dashboard stats"

    # 统计
    test_api "GET" "/api/v1/app/stats" "App stats"
}
