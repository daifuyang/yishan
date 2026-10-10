#!/bin/bash
# Admin - 菜单管理模块测试

run_tests() {
    echo ""
    echo "=== Admin Menus 模块 ==="

    test_api "GET" "/api/v1/admin/menus/" "List menus"
    test_api "GET" "/api/v1/admin/menus/tree" "Menu tree"
    test_api "GET" "/api/v1/admin/menus/tree/authorized" "Authorized menu tree"
    test_api "GET" "/api/v1/admin/menus/paths/authorized" "Authorized menu paths"

    # 获取一个父菜单用于创建子菜单
    local menu_id=1
    test_api "GET" "/api/v1/admin/menus/${menu_id}" "Get menu detail"

    # 创建菜单（使用唯一路径避免冲突）
    test_api "POST" "/api/v1/admin/menus/" "Create menu" "200" "{
        \"parentId\":$menu_id,
        \"name\":\"测试菜单_$(date +%s)\",
        \"path\":\"/test-menu-$(date +%s)\",
        \"icon\":\"test\",
        \"sort\":999,
        \"type\":1,
        \"status\":1
    }"
}
