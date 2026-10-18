# 用户表单日期提交及网格布局修复（2026-10-18）

## 原因

出生日期由 ProForm 默认 dateFormatter 转成字符串后，旧 transform 再调用 value.format，抛出 `value.format is not a function`，onFinish 没有执行，也没有创建请求。之前仅验证无出生日期的创建，漏掉了该场景。

头像用了未参与网格的 Form.Item，colProps 没有生成列容器，导致状态向左错位；默认 Row 的负边距另造成 4px 横向溢出。

## 修复与验证

- 删除冗余日期 transform，使用原组件的日期序列化，创建和编辑均提交 YYYY-MM-DD。
- 头像使用标准 Col span12，内部附件 Form.Item 绑定保持原样；Row 水平外边距归零，不隐藏 overflow。
- 用户表单行为测试 23 项通过，包括有日期/无日期创建、已有日期编辑、字段补丁、表单关闭和保存回执。
- Chromium 复现修复前异常且没有请求；修复后生日 1996-10-01 出现在原创建请求，无页面异常。请求由测试适配器记录，没有写入真实数据库。
- Chromium 验证 1440、900、660px 宽度的头像/状态同排等宽，表单 scrollWidth 等于 clientWidth。
- Admin 和 Core System Admin 类型检查通过，修改文件 lint 通过。
