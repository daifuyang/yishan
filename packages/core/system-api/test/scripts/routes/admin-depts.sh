#!/bin/bash
# Admin - 部门管理模块测试

run_tests() {
    echo ""
    echo "=== Admin Departments 模块 ==="

    test_api "GET" "/api/v1/admin/departments/" "List departments"
    test_api "GET" "/api/v1/admin/departments/tree" "Department tree"
    test_api "GET" "/api/v1/admin/departments/1" "Get department detail (id=1)"

    # 创建部门（使用唯一名称避免重复）
    test_api "POST" "/api/v1/admin/departments/" "Create department" "200" "{
        \"parentId\":1,
        \"name\":\"测试部门_$(date +%s)\",
        \"code\":\"TEST_DEPT_$(date +%s)\",
        \"sort\":99,
        \"status\":1,
        \"leader\":\"测试负责人\"
    }"
}
