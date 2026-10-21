import {
  ProForm,
  type ProFormInstance,
} from '@ant-design/pro-components';
import type {
  AiFormCompletionHandle,
  AiFormCompletionOutcome,
  AiFormCompletionProps,
  AiFormCompletionSubmission,
} from '@yishan/core-admin/form-assistance';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useSystemAdmin } from '../../../runtime';
import {
  createUser,
  getUserCreateForm as requestUserCreateForm,
  getUserCreateOptions as requestUserCreateOptions,
} from '../../../services/generated/sysUsers';
import { toContractDate } from '../../../utils/date-field';
import type { UserCreateDraftSubmission } from '../../../form-assistance';
import {
  UserCreateFields,
  useUserCreateEnumOptions,
  type UserCreateFormDefinition,
} from './UserCreateFields';

/**
 * UserCreateCompletionForm — 「新建用户」的 **AI 补全表单**。
 *
 * 它是原生新建用户表单的**字段过滤展示模式**，不是第二套表单系统：
 *
 * 1. 字段、标签、必填、校验、候选来源、头像上传、密码控件全部来自
 *    `UserCreateFields`（与原生表单同一份渲染）与服务端 `create-form` 契约；
 * 2. 只渲染「服务端算出来的待补全字段」，一次全部展示，不一个一个地问；
 * 3. 密码用原生控件，值只活在这一次表单里：**不进草稿、不进模型上下文、
 *    不进日志**，提交时随这一次请求走原生安全链路；
 * 4. 头像复用原生上传控件（类型/大小校验、上传态、预览、失败处理、附件映射），
 *    是否必填只由契约决定。
 *
 * 提交走 `submitUserCreateCompletion`：**原有业务创建接口** + 草稿关联，
 * 服务端重新鉴权、重新校验，并保证「一份草稿最多完成一次创建」。
 */

/** 取服务端表单定义；拿不到时补全表单退回到静态兜底规则。 */
async function fetchUserCreateForm(): Promise<UserCreateFormDefinition | null> {
  try {
    const response = await requestUserCreateForm();
    return response?.success && response.data ? response.data : null;
  } catch {
    return null;
  }
}

/** 取候选（部门树 / 角色）；拿不到时返回空候选，由服务端在提交时再校验一次。 */
async function fetchUserCreateOptions(
  query: SystemAPI.getUserCreateOptionsParams,
): Promise<SystemAPI.userCreateOptionsResp['data'] | null> {
  try {
    const response = await requestUserCreateOptions(query);
    return response?.success && response.data ? response.data : null;
  } catch {
    return null;
  }
}

export const UserCreateCompletionForm = forwardRef<
  AiFormCompletionHandle,
  AiFormCompletionProps
>(function UserCreateCompletionForm(props, ref) {
  const { initialState } = useSystemAdmin();
  const dictDataMap = initialState?.dictDataMap || {};
  const genderDict = dictDataMap.user_gender || [];
  const userStatusDict = dictDataMap.user_status || [];

  const [definition, setDefinition] = useState<UserCreateFormDefinition | null>(
    null,
  );
  const formRef = useRef<ProFormInstance>(undefined);

  useEffect(() => {
    let cancelled = false;
    void fetchUserCreateForm().then((form) => {
      if (!cancelled) setDefinition(form);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enumOptions = useUserCreateEnumOptions(definition);
  const genderOptions = enumOptions('gender', genderDict);
  const statusOptions = enumOptions('status', userStatusDict);

  /** 同源部门候选：与提交时的授权范围同源（`create-options`）。 */
  const deptTreeRequest = useCallback(async () => {
    const options = await fetchUserCreateOptions({
      deptIds: formRef.current?.getFieldValue('deptIds') as
        | number[]
        | undefined,
    });
    return options?.departments ?? [];
  }, []);

  /** 同源角色候选：按当前部门重算，不另建一套选项权限。 */
  const roleRequest = useCallback(
    async (params: { keyWords?: string }) => {
      const options = await fetchUserCreateOptions({
        deptIds:
          (formRef.current?.getFieldValue('deptIds') as number[] | undefined) ??
          [],
        keyword: params.keyWords,
      });
      return (options?.roles ?? []).map((role) => ({
        label: role.name,
        value: role.id,
      }));
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      /**
       * 触发**原生表单自己的**校验：通过时返回当前全部字段值，
       * 不通过时抛出（错误由表单显示在字段上）。
       */
      validate: async () => {
        const instance = formRef.current;
        if (!instance) return { ...props.values };
        const values = await instance.validateFields();
        return { ...props.values, ...(values ?? {}) };
      },
    }),
    [props.values],
  );

  return (
    <ProForm
      formRef={formRef}
      layout="vertical"
      grid
      rowProps={{ style: { marginInline: 0 } }}
      initialValues={props.values}
      disabled={props.disabled}
      onValuesChange={(_changed, allValues) => {
        props.onChange({ ...props.values, ...(allValues ?? {}) });
      }}
    >
      <UserCreateFields
        definition={definition}
        only={props.fields.map((field) => field.name)}
        genderOptions={genderOptions}
        statusOptions={statusOptions}
        deptTreeRequest={deptTreeRequest}
        roleRequest={roleRequest}
        disabled={props.disabled}
      />
    </ProForm>
  );
});

/**
 * 走**原有业务创建接口**完成这次创建。
 *
 * 三条不可放宽的规则：
 *
 * 1. 敏感值（密码、头像）只出现在**这一次**请求里：不写草稿、不进日志、
 *    不进模型上下文。
 * 2. 带 `draftSubmission`：服务端在同一事务里认领草稿、创建用户、写回执，
 *    同一份草稿最多完成一次创建（重复提交会被幂等挡住）。
 * 3. 失败时**不自动重发**：把服务端说的原因原样带回界面，由用户决定。
 */
export async function submitUserCreateCompletion(
  submission: AiFormCompletionSubmission,
): Promise<AiFormCompletionOutcome> {
  const values = submission.values ?? {};
  const draftSubmission: UserCreateDraftSubmission = {
    draftId: submission.draftId,
    draftVersion: submission.draftVersion,
  };
  type CreateUserPayload = SystemAPI.createUserReq & {
    draftSubmission?: UserCreateDraftSubmission;
  };
  const payload: CreateUserPayload = {
    username: values.username as string | undefined,
    email: values.email as string | undefined,
    phone: (values.phone as string | undefined) ?? '',
    realName: values.realName as string | undefined,
    nickname: values.nickname as string | undefined,
    gender: values.gender as SystemAPI.createUserReq['gender'],
    status: values.status as SystemAPI.createUserReq['status'],
    // 契约是 `format: "date"`，只收 YYYY-MM-DD。
    birthDate: toContractDate(values.birthDate) as string | undefined,
    deptIds: values.deptIds as number[] | undefined,
    roleIds: values.roleIds as number[] | undefined,
    password: (values.password as string | undefined) ?? '',
    avatar: values.avatar as string | undefined,
    draftSubmission,
  };
  try {
    const res = await createUser(payload as SystemAPI.createUserReq);
    if (res.success) return { ok: true, message: '用户创建成功' };
    return {
      ok: false,
      message: res.message || '用户创建失败，请检查填写内容后重试',
    };
  } catch {
    return { ok: false, message: '用户创建失败，请稍后重试' };
  }
}
