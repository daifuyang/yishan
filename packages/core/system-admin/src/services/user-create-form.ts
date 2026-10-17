/**
 * 新增用户表单的**同源**字段定义与候选查询。
 *
 * 为什么要单独手写而不是用生成客户端：Task 3 刚给后端加了
 * `GET /admin/users/create-form` 与 `GET /admin/users/create-options`，
 * 而生成的 OpenAPI 客户端要到 Task 10 才重新生成。手写这一小层是为了**现在**
 * 就能让原生表单用上同源约束，而不是继续维护第二份硬编码字段表。
 *
 * Task 10 重新生成后，本文件应整体删除，调用方改用 `services/generated`；
 * 类型定义刻意与后端 schema 一致，替换时不会有行为差异。
 */
import { request } from '@umijs/max';

export interface UserCreateFormField {
  name: string;
  label: string;
  required: boolean;
  /** 密码等：只能由用户在受保护的表单里输入。 */
  sensitive: boolean;
  /** 既有候选来源的标识，不是可执行渲染代码。 */
  selector: string;
  /** 来自真实 create schema 的约束子集。 */
  constraints: Record<string, unknown>;
}

export interface UserCreateForm {
  schemaVersion: number;
  fields: UserCreateFormField[];
  defaults: Record<string, unknown>;
  /** 对话/助手可写入的字段白名单（= USER_CREATE_DRAFT_FIELD_KEYS）。 */
  editableFields: string[];
  missingFields: { name: string; label: string; required: boolean; sensitive: boolean }[];
}

export interface UserCreateOption {
  id: number;
  name: string;
}

export interface UserCreateDeptNode extends UserCreateOption {
  children?: UserCreateDeptNode[] | null;
}

export interface UserCreateOptions {
  departments: UserCreateDeptNode[];
  /** 按候选 deptIds 重算后的可授予角色。 */
  roles: UserCreateOption[];
  total: number;
  page: number;
  pageSize: number;
  /** 操作者在 system:user:create 上的范围是否至少能建一个用户。 */
  creatable: boolean;
}

type Resp<T> = { success?: boolean; message?: string; data?: T };

/**
 * 字段定义。失败时返回 null —— 表单退回既有静态规则，绝不因为元数据端点
 * 不可用就把「新建用户」变成不可用。
 */
export async function getUserCreateForm(): Promise<UserCreateForm | null> {
  try {
    const res = (await request<Resp<UserCreateForm>>('/api/v1/admin/users/create-form', {
      method: 'GET',
    }));
    return res?.success && res.data ? res.data : null;
  } catch {
    return null;
  }
}

/**
 * 候选选项。`deptIds` 参与角色候选的**重算**，因此部门变化后必须重新查询，
 * 不能拿上一轮的候选继续显示。
 */
export async function getUserCreateOptions(query: {
  deptIds?: number[];
  keyword?: string;
  pageSize?: number;
}): Promise<UserCreateOptions | null> {
  try {
    const res = (await request<Resp<UserCreateOptions>>('/api/v1/admin/users/create-options', {
      method: 'GET',
      params: {
        deptIds: query.deptIds,
        keyword: query.keyword,
        pageSize: query.pageSize ?? 100,
      },
    }));
    return res?.success && res.data ? res.data : null;
  } catch {
    return null;
  }
}
