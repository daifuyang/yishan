import React from "react";
import {
  ProFormTreeSelect,
  type ProFormTreeSelectProps,
} from "@ant-design/pro-components";
import { getDeptTree } from "@/services/yishan-admin/sysDepts";

/**
 * ProForm 部门树选择组件
 * 基于 ProFormSelect 封装的部门选择组件，使用树形数据格式
 */
export const ProFormDeptTreeSelect: React.FC<ProFormTreeSelectProps> = ({
  name = "deptId",
  label = "归属部门",
  placeholder = "请选择归属部门",
  allowClear = true,
  disabled = false,
  fieldProps = {},
  ...restProps
}) => {
  return (
    <ProFormTreeSelect
      name={name}
      label={label}
      placeholder={placeholder}
      allowClear={allowClear}
      disabled={disabled}
      request={async () => {
        try {
          const response = await getDeptTree();
          if (response.success && response.data) {
            return response.data;
          }
          return [];
        } catch (error) {
          console.error("获取部门树失败:", error);
          return [];
        }
      }}
      fieldProps={{
        fieldNames: {
          label: "name",
          value: "id",
          children: "children",
        },
        showSearch: true,
        treeDefaultExpandAll: true,
        treeNodeFilterProp: "name",
        multiple: true,
        ...fieldProps,
      }}
      {...restProps}
    />
  );
};
