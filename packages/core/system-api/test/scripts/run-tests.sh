#!/bin/bash
# Yishan API 模块化测试框架
#
# 用法:
#   ./run-tests.sh              # 运行所有测试
#   ./run-tests.sh auth         # 只运行认证测试
#   ./run-tests.sh admin-users  # 只运行用户管理测试
#   ./run-tests.sh portal shop  # 运行多个模块测试

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

# 可用的测试模块
AVAILABLE_MODULES=(
    "auth"
    "admin-users"
    "admin-roles"
    "admin-menus"
    "admin-depts"
    "admin-dicts"
    "admin-attachments"
    "admin-system"
    "app"
    "me"
    "portal-articles"
    "portal-pages"
    "portal-categories"
    "portal-posts"
    "shop-products"
    "shop-orders"
    "shop-categories"
    "shop-attributes"
)

# 显示用法
usage() {
    echo "Yishan API 模块化测试框架"
    echo ""
    echo "用法:"
    echo "  $0                    # 运行所有测试"
    echo "  $0 <模块名>...        # 运行指定模块测试"
    echo ""
    echo "可用模块:"
    for mod in "${AVAILABLE_MODULES[@]}"; do
        echo "  - $mod"
    done
    echo ""
    echo "示例:"
    echo "  $0 auth admin-users           # 运行认证和用户管理测试"
    echo "  $0 portal-articles shop-*    # 运行 Portal 和所有 Shop 测试"
}

# 运行指定模块
run_module() {
    local module=$1
    local module_script="${SCRIPT_DIR}/routes/${module}.sh"

    if [ ! -f "$module_script" ]; then
        log_error "模块不存在: $module"
        return 1
    fi

    log_step "=========================================="
    log_step "Running: $module"
    log_step "=========================================="

    # 加载模块（模块内可以访问 common.sh 的函数）
    source "$module_script"

    # 运行模块的 run_tests 函数（如果模块定义了的话）
    if declare -f run_tests > /dev/null 2>&1; then
        run_tests
        # 取消定义以避免冲突
        unset -f run_tests
    fi

    echo ""
}

# 运行所有模块
run_all_modules() {
    log_info "将运行 ${#AVAILABLE_MODULES[@]} 个测试模块..."
    echo ""

    for module in "${AVAILABLE_MODULES[@]}"; do
        run_module "$module" || true
    done
}

# 主流程
main() {
    echo ""
    echo "=============================================="
    echo "      Yishan API End-to-End Test Suite"
    echo "=============================================="
    echo ""

    # 0. 预检
    check_api || exit 1

    # 1. 登录
    do_login || exit 1

    # 2. 根据参数决定运行哪些模块
    if [ $# -eq 0 ]; then
        # 运行所有模块
        run_all_modules
    else
        # 运行指定模块
        for module in "$@"; do
            run_module "$module"
        done
    fi

    # 3. 登出
    echo ""
    log_step "=========================================="
    log_step "Cleanup"
    log_step "=========================================="
    do_logout

    # 4. 报告
    print_report
}

# 执行
main "$@"
