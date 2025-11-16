import React, { useMemo } from "react";
import {
  ModalForm,
  ProFormText,
  ProFormRadio,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
} from "@ant-design/pro-components";
import type { FormInstance } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { getRoleList } from "@/services/yishan-admin/sysRoles";
import { getPostList } from "@/services/yishan-admin/sysPosts";
import { ProFormDeptTreeSelect } from "@/components";

export interface UserFormProps {
  form: FormInstance;
  open: boolean;
  mode: "create" | "edit";
  title: string;
  initialValues?: API.sysUser;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: API.createUserReq | API.updateUserReq) => Promise<void>;
}

const UserForm: React.FC<UserFormProps> = ({
  form,
  open,
  mode,
  title,
  initialValues,
  onOpenChange,
  onSubmit,
}) => {
  const initialVals = useMemo(() => {
    if (initialValues) {
      return {
        username: initialValues.username,
        realName: initialValues.realName,
        nickname: (initialValues as any).nickname,
        email: initialValues.email,
        phone: initialValues.phone,
        gender: initialValues.gender,
        status: initialValues.status,
        birthDate: initialValues.birthDate ? dayjs(initialValues.birthDate) : undefined,
        deptId: (initialValues as any).deptId,
        postIds: (initialValues as any).postIds,
        roleIds: (initialValues as any).roleIds,
        remark: (initialValues as any).remark,
      } as any;
    }
    return { status: 1, gender: 0 } as any;
  }, [initialValues]);

  const handleFinish = async (values: any) => {
    const payload: any = {
      username: values.username,
      realName: values.realName,
      nickname: values.nickname,
      email: values.email,
      phone: values.phone,
      gender: values.gender,
      status: values.status,
      birthDate: values.birthDate,
      deptId: values.deptId,
      postIds: values.postIds,
      roleIds: values.roleIds,
      remark: values.remark,
    };
    if (mode === "create") {
      payload.password = values.password;
    } else if (values.password && String(values.password).trim().length > 0) {
      payload.password = values.password;
    }
    await onSubmit(payload);
    return true;
  };

  return (
    <ModalForm
      form={form}
      title={title}
      open={open}
      onOpenChange={onOpenChange}
      autoFocusFirstInput
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      grid
      initialValues={initialVals}
      syncToInitialValues
      onFinish={handleFinish}
    >
      <ProFormText
        name="username"
        label="登录名称"
        placeholder="请输入登录名称"
        colProps={{ span: 12 }}
        fieldProps={{
          autoComplete: 'off'
        }}
      />

      <ProFormDeptTreeSelect
        name="deptId"
        label="归属部门"
        placeholder="请选择归属部门"
        allowClear
        colProps={{ span: 12 }}
      />

      <ProFormText
        name="phone"
        label="手机号码"
        placeholder="请输入手机号"
        rules={[{ required: true, message: "请输入手机号" }, { max: 11 }]}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="email"
        label="邮箱"
        placeholder="请输入邮箱"
        rules={[{ type: "email", message: "邮箱格式不正确" }]}
        colProps={{ span: 12 }}
      />

      <ProFormText
        name="realName"
        label="真实姓名"
        placeholder="请输入真实姓名"
        rules={[{ min: 1, max: 50, message: "真实姓名长度不能超过50个字符" }]}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="nickname"
        label="用户昵称"
        placeholder="请输入用户昵称"
        rules={[{ min: 1, max: 50, message: "用户昵称长度必须在1到50个字符之间" }]}
        colProps={{ span: 12 }}
      />
      <ProFormText.Password
        name="password"
        label="用户密码"
        placeholder={mode === "create" ? "请输入密码" : "不输入则保持原密码"}
        rules={[
          { required: mode === "create", message: "请输入密码" },
          { min: 6, message: "至少6位" },
        ]}
        colProps={{ span: 12 }}
        fieldProps={{
          autoComplete: 'new-password'
        }}
      />

      <ProFormRadio.Group
        name="gender"
        label="用户性别"
        options={[
          { label: "未知", value: 0 },
          { label: "男", value: 1 },
          { label: "女", value: 2 },
        ]}
        colProps={{ span: 12 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        options={[
          { label: "禁用", value: 0 },
          { label: "启用", value: 1 },
          { label: "锁定", value: 2 },
        ]}
        colProps={{ span: 12 }}
      />

      <ProFormSelect
        name="postIds"
        label="岗位"
        placeholder="请选择岗位"
        showSearch
        request={async () => {
          const res = await getPostList({
            page: 1,
            pageSize: 100,
            status: 1,
            sortBy: "sort_order",
            sortOrder: "asc",
          });
          return (res.data || []).map((p: API.sysPost) => ({
            label: p.name,
            value: p.id,
          }));
        }}
        fieldProps={{ mode: "multiple", maxTagCount: "responsive" }}
        colProps={{ span: 12 }}
      />

      <ProFormSelect
        name="roleIds"
        label="角色"
        placeholder="请选择角色"
        showSearch
        request={async () => {
          const res = await getRoleList({
            page: 1,
            pageSize: 100,
            status: 1,
            sortBy: "createdAt",
            sortOrder: "desc",
          });
          return (res.data || []).map((r: API.sysRole) => ({
            label: r.name,
            value: r.id,
          }));
        }}
        fieldProps={{ mode: "multiple", maxTagCount: "responsive" }}
        colProps={{ span: 12 }}
      />

      <ProFormDatePicker
        name="birthDate"
        label="出生日期"
        placeholder="请选择出生日期"
        fieldProps={{ style: { width: "100%" } }}
        colProps={{ span: 12 }}
        transform={(value: Dayjs | null) => ({ birthDate: value ? value.format("YYYY-MM-DD") : undefined })}
      />

      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="请输入内容"
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default UserForm;
