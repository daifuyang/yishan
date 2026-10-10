#!/bin/bash
# Admin - 素材管理模块测试

run_tests() {
    echo ""
    echo "=== Admin Attachments 模块 ==="

    test_api "GET" "/api/v1/admin/attachments/folders" "List folders"
    test_api "GET" "/api/v1/admin/attachments/folders/tree" "Folder tree"
    test_api "GET" "/api/v1/admin/attachments/" "List attachments"
}
