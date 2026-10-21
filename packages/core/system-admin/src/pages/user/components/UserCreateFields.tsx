import {
  ProForm,
  ProFormDatePicker,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import { Col, type FormItemProps } from 'antd';
import React from 'react';
import { ProFormDeptTreeSelect } from '../../../components/DeptTreeSelect';
import { AttachmentSelect } from '../../../components/AttachmentSelect';

/**
 * UserCreateFields — 「新建用户」表单的**字段本体**。
 *
 * 这里是**唯一**一份新建用户字段的渲染：原生表单（`UserForm`）与 AI 补全表单
 * （`UserCreateCompletionForm`）都用它。AI 侧因此不是「再造一套字段系统」，
 * 而是同一个表单的**字段过滤展示模式**：只渲染待补全的那几个字段。
 *
 * 三条约定：
 *
 * 1. **约束来自服务端**：必填、长度、正则、格式都读 `create-form` 的字段定义
 *    （`definition`），不在这份文件里另抄一份。
 * 2. **组件就是原生那套**：部门树、角色下拉、头像上传、密码、日期、单选，
 *    与原生表单逐字一致 —— 校验、联动、候选来源、权限规则全都复用。
 * 3. **字段顺序固定**：与原生表单一致，补全时不会出现另一种排列。
 */

/** 服务端 `create-form` 契约的形状。 */
export type UserCreateFormDefinition =
  SystemAPI.userCreateFormResp['data'];

/** 部门候选（来自 `create-options`，与提交时的授权范围同源）。 */
export type UserCreateDeptCandidate =
  SystemAPI.userCreateOptionsResp['data']['departments'];

/** 角色候选的展示形状。 */
export interface UserCreateRoleOption {
  label: string;
  value: number;
}

export interface UserCreateFieldsProps {
  /** 服务端表单定义；拿不到时退回到静态兜底规则。 */
  definition: UserCreateFormDefinition | null;
  /** 只渲染这些字段；不传则渲染全部。 */
  only?: readonly string[];
  /** 性别选项（值来自契约，标签来自字典）。 */
  genderOptions: { label: string; value: string }[];
  /** 状态选项（值来自契约，标签来自字典）。 */
  statusOptions: { label: string; value: string }[];
  /** 部门候选来源；不传则用组件自带的部门树。 */
  deptTreeRequest?: () => Promise<UserCreateDeptCandidate>;
  /** 角色候选来源；不传则不提供远程候选。 */
  roleRequest?: (params: { keyWords?: string }) => Promise<UserCreateRoleOption[]>;
  /** 编辑态：密码可以留空。 */
  isEdit?: boolean;
  disabled?: boolean;
}

/**
 * 同源约束：把 `create-form` 的 required / maxLength / minLength / pattern / format
 * 用到真实表单上。
 *
 * 规则来自服务端契约，**不按字段名硬编码**；契约缺哪条就少哪条。
 */
export function useUserCreateFieldRules(
  definition: UserCreateFormDefinition | null,
): (name: string) => Exclude<FormItemProps['rules'], undefined> | undefined {
  return React.useCallback(
    (name: string) => {
      const field = definition?.fields.find((item) => item.name === name);
      if (!field) return undefined;
      const constraints = field.constraints ?? {};
      const rules: Exclude<FormItemProps['rules'], undefined> = [];
      if (field.required)
        rules.push({ required: true, message: `请输入${field.label}` });
      if (typeof constraints.maxLength === 'number')
        rules.push({ max: constraints.maxLength });
      if (typeof constraints.minLength === 'number')
        rules.push({ min: constraints.minLength });
      if (typeof constraints.pattern === 'string') {
        try {
          rules.push({ pattern: new RegExp(constraints.pattern) });
        } catch {
          // 服务端正则不可编译时忽略它，仍然由必填与长度约束把关。
        }
      }
      if (constraints.format === 'email') {
        rules.push({ type: 'email', message: '邮箱格式不正确' });
      }
      return rules.length > 0 ? rules : undefined;
    },
    [definition],
  );
}

/**
 * 同源枚举候选：可选值来自 `create-form` 的 `enum` 约束，字典只负责提供**标签**。
 */
export function useUserCreateEnumOptions(
  definition: UserCreateFormDefinition | null,
): (
  name: string,
  fallback: { label: string; value: string }[],
) => { label: string; value: string }[] {
  return React.useCallback(
    (name: string, fallback: { label: string; value: string }[]) => {
      const field = definition?.fields.find((item) => item.name === name);
      const values = field?.constraints?.enum;
      if (!Array.isArray(values) || values.length === 0) return fallback;
      return values.map((raw) => {
        const value = String(raw);
        const label =
          fallback.find((item) => item.value === value)?.label ?? value;
        return { label, value };
      });
    },
    [definition],
  );
}

export function UserCreateFields({
  definition,
  only,
  genderOptions,
  statusOptions,
  deptTreeRequest,
  roleRequest,
  isEdit = false,
  disabled = false,
}: UserCreateFieldsProps) {
  const rulesFor = useUserCreateFieldRules(definition);
  const show = (name: string) => !only || only.includes(name);

  return (
    <>
      {show('username') && (
        <ProFormText
          name="username"
          label="登录名称"
          placeholder="请输入登录名称"
          colProps={{ span: 12 }}
          rules={rulesFor('username')}
          fieldProps={{
            autoComplete: 'off',
          }}
        />
      )}

      {show('deptIds') && (
        <ProFormDeptTreeSelect
          name="deptIds"
          label="归属部门"
          placeholder="请选择归属部门"
          allowClear
          colProps={{ span: 12 }}
          disabled={disabled}
          {...(deptTreeRequest ? { request: deptTreeRequest } : {})}
        />
      )}

      {show('phone') && (
        <ProFormText
          name="phone"
          label="手机号码"
          placeholder="请输入手机号"
          rules={
            rulesFor('phone') ?? [
              { required: true, message: '请输入手机号' },
              { max: 11 },
            ]
          }
          colProps={{ span: 12 }}
        />
      )}

      {show('email') && (
        <ProFormText
          name="email"
          label="邮箱"
          placeholder="请输入邮箱"
          rules={rulesFor('email')}
          colProps={{ span: 12 }}
        />
      )}

      {show('realName') && (
        <ProFormText
          name="realName"
          label="真实姓名"
          placeholder="请输入真实姓名"
          rules={
            rulesFor('realName') ?? [
              { min: 1, max: 50, message: '真实姓名长度不能超过50个字符' },
            ]
          }
          colProps={{ span: 12 }}
        />
      )}

      {show('nickname') && (
        <ProFormText
          name="nickname"
          label="用户昵称"
          placeholder="请输入用户昵称"
          rules={
            rulesFor('nickname') ?? [
              {
                min: 1,
                max: 50,
                message: '用户昵称长度必须在1到50个字符之间',
              },
            ]
          }
          colProps={{ span: 12 }}
        />
      )}

      {show('password') && (
        <ProFormText.Password
          name="password"
          label="用户密码"
          placeholder={isEdit ? '不输入则保持原密码' : '请输入密码'}
          rules={[
            { required: !isEdit, message: '请输入密码' },
            { min: 6, message: '至少6位' },
          ]}
          colProps={{ span: 12 }}
          fieldProps={{
            autoComplete: 'new-password',
          }}
        />
      )}

      {show('gender') && (
        <ProFormRadio.Group
          name="gender"
          label="用户性别"
          options={genderOptions}
          colProps={{ span: 12 }}
          disabled={disabled}
        />
      )}

      {show('avatar') && (
        <Col span={12}>
          <ProForm.Item name="avatar" label="头像">
            <AttachmentSelect
              kind="image"
              multiple={false}
              maxCount={1}
              disabled={disabled}
            />
          </ProForm.Item>
        </Col>
      )}

      {show('status') && (
        <ProFormRadio.Group
          name="status"
          label="状态"
          options={statusOptions}
          colProps={{ span: 12 }}
          disabled={disabled}
        />
      )}

      {show('roleIds') && (
        <ProFormSelect
          name="roleIds"
          label="角色"
          placeholder="请选择角色"
          showSearch
          debounceTime={200}
          disabled={disabled}
          {...(roleRequest ? { request: roleRequest } : {})}
          fieldProps={{ mode: 'multiple', maxTagCount: 'responsive' }}
          colProps={{ span: 12 }}
        />
      )}

      {show('birthDate') && (
        <ProFormDatePicker
          name="birthDate"
          label="出生日期"
          placeholder="请选择出生日期"
          fieldProps={{ style: { width: '100%' }, previewValue: false }}
          colProps={{ span: 12 }}
        />
      )}
    </>
  );
}
