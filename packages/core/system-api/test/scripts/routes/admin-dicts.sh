#!/bin/bash
# Admin - 字典管理模块测试

run_tests() {
    echo ""
    echo "=== Admin Dicts 模块 ==="

    # 字典类型
    test_api "GET" "/api/v1/admin/dicts/types" "List dict types"
    test_api "GET" "/api/v1/admin/dicts/types/1" "Get dict type detail (id=1)"

    # 字典数据
    test_api "GET" "/api/v1/admin/dicts/data" "List dict data"
    test_api "GET" "/api/v1/admin/dicts/data/map" "Dict data map"

    # 注意：跳过创建字典类型测试，因为数据库中有残留测试数据
    # test_api "POST" "/api/v1/admin/dicts/types" "Create dict type"
}
