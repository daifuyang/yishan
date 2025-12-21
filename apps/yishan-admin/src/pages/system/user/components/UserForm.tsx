import React, { useRef } from "react";
import {
  ModalForm,
  ProFormText,
  ProFormRadio,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
} from "@ant-design/pro-components";
import type { Dayjs } from "dayjs";
import { useModel } from "@umijs/max";
import { getRoleList } from "@/services/yishan-admin/sysRoles";
import { getPostList } from "@/services/yishan-admin/sysPosts";
import { getUserDetail, createUser, updateUser } from "@/services/yishan-admin/sysUsers";
import { ProFormDeptTreeSelect } from "@/components";

export interface UserFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.sysUser>;
  onFinish?: () => Promise<void>;
  onInit?: () => Promise<API.sysUser | undefined>;
}

const UserForm: React.FC<UserFormProps> = ({
  title,
  trigger,
  initialValues = { status: "1", gender: "0" },
  onFinish,
}) => {
  // 获取全局字典数据
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};

  // 获取性别字典
  const genderDict = dictDataMap.user_gender || [];
  // 获取用户状态字典
  const userStatusDict = dictDataMap.user_status || [];

  const formRef = useRef<any>(undefined);

  // 获取用户详情
  const fetchUserDetail = async (id: number) => {
    const res = await getUserDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue(res.data);
    }
  };

  const handleFinish = async (values: any) => {
    const basePayload: any = {
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

    if (!initialValues?.id) {
      const payload: API.createUserReq = {
        ...basePayload,
        password: values.password,
      };
      const res = await createUser(payload);
      if (res.success) {
        if (onFinish) await onFinish();
        return true;
      }
      return false;
    }

    const payload: API.updateUserReq = { ...basePayload };
    if (values.password && String(values.password).trim().length > 0) {
      payload.password = values.password;
    }
    const res = await updateUser({ id: Number(initialValues.id) }, payload);
    if (res.success) {
      if (onFinish) await onFinish();
      return true;
    }
    return false;
  };

  if (!trigger) return null;

  return (
    <ModalForm
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      grid
      formRef={formRef}
      initialValues={initialValues}
      onFinish={handleFinish}
      onOpenChange={(open) => {
        if (open) {
          if (initialValues?.id) {
            fetchUserDetail(initialValues.id);
          }
        }
      }}
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
        placeholder={!initialValues?.id ? "请输入密码" : "不输入则保持原密码"}
        rules={[
          { required: !initialValues?.id, message: "请输入密码" },
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
        options={genderDict}
        colProps={{ span: 12 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        options={userStatusDict}
        colProps={{ span: 12 }}
      />

      <ProFormSelect
        name="postIds"
        label="岗位"
        placeholder="请选择岗位"
        showSearch
        debounceTime={200}
        request={async (params) => {
          const res = await getPostList({
            page: 1,
            pageSize: 100,
            status: "1",
            keyword: params.keyWords,
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
        debounceTime={200}
        request={async (params) => {
          const res = await getRoleList({
            page: 1,
            pageSize: 100,
            status: "1",
            keyword: params.keyWords,
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
