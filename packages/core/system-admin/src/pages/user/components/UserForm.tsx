import type {} from '../../../types/index';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ModalForm,
  type ProFormInstance,
  ProFormText,
  ProFormRadio,
  ProFormDatePicker,
  ProFormSelect,
} from "@ant-design/pro-components";
import type { Dayjs } from "dayjs";
import { Alert, type FormItemProps } from "antd";
import { useSystemAdmin } from "../../../runtime";
import { getRoleList } from "../../../services/generated/sysRoles";
import { getUserDetail, createUser, updateUser } from "../../../services/generated/sysUsers";
import {
  getUserCreateForm,
  getUserCreateOptions,
  type UserCreateForm,
} from "../../../services/user-create-form";
import { ProFormDeptTreeSelect } from "../../../components/DeptTreeSelect";
import {
  APPLY_CONFLICT,
  invalidateUserCreateFormHandle,
  isCurrentUserCreateFormHandle,
  notifyUserFormOverlay,
  registerUserCreateFormHandle,
  registerUserFormOverlay,
  restoreUserCreateFormHandle,
  subscribeUserCreateFormTarget,
  useCoordinatedFormFocus,
  USER_FORM_ASSISTANCE_TARGET,
  type UserCreateDraftFields,
  type UserFormOverlayInfo,
  type UserFormSnapshot,
} from "../../../form-assistance";
import {
  consumeAiPrefill,
  subscribeAiPrefill,
} from "../../../ai-prefill";

export interface UserFormProps {
  title: string;
  trigger?: React.JSX.Element;
  initialValues?: Partial<SystemAPI.sysUser>;
  onFinish?: () => Promise<void>;
  onInit?: () => Promise<SystemAPI.sysUser | undefined>;
  /**
   * 受控开关。AI 预填命中时用它直接弹表单——此时没有 trigger 可点，
   * 所以传了 `open` 就不要求 `trigger`。
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * 打开协作契约。只有「新建用户」传 `'user.create'`；编辑用户表单永远不注册，
   * 助手因此无法把创建意图写进一个编辑表单（设计 §3.2）。
   */
  assistance?: typeof USER_FORM_ASSISTANCE_TARGET;
}

type DraftFields = UserCreateDraftFields & Record<string, unknown>;

const UserForm: React.FC<UserFormProps> = ({
  title,
  trigger,
  initialValues = { status: "1", gender: "0" },
  onFinish,
  open,
  onOpenChange,
  assistance,
}) => {
  // 获取全局字典数据
  const { initialState } = useSystemAdmin();
  const dictDataMap = initialState?.dictDataMap || {};

  // 获取性别字典
  const genderDict = dictDataMap.user_gender || [];
  // 获取用户状态字典
  const userStatusDict = dictDataMap.user_status || [];

  const formRef = useRef<ProFormInstance>(undefined);

  // ---- 单一数据来源：可见表单值就是唯一可编辑状态，没有第二套草稿 store ----
  const isEdit = Boolean(initialValues?.id);
  const assistEnabled = assistance === USER_FORM_ASSISTANCE_TARGET && !isEdit;
  const identity = initialState?.currentUser?.id ?? 'anonymous';

  /** 当前打开的表单实例标识；未打开过为空串。 */
  const instanceIdRef = useRef('');
  const openCountRef = useRef(0);
  const openRef = useRef(false);
  const revisionRef = useRef(0);
  const valuesRef = useRef<Record<string, unknown>>({});
  /** 打开表单瞬间持有焦点的元素：关闭助手后把焦点还回去（设计 §4）。 */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /** 字段来源：'user' = 用户手改，'assistant' = 助手写入。 */
  const provenanceRef = useRef<Record<string, 'user' | 'assistant'>>({});
  /** 同源字段定义（Task 3）；拿不到时退回既有静态规则。 */
  const [createForm, setCreateForm] = useState<UserCreateForm | null>(null);
  const createFormRef = useRef<UserCreateForm | null>(null);
  createFormRef.current = createForm;
  const [prefillMissing, setPrefillMissing] = useState<readonly string[]>([]);
  /** 协作入口可能没有 trigger，因此允许把它「叫醒」渲染。 */
  const [collaborationRendered, setCollaborationRendered] = useState(false);

  const isControlled = open !== undefined;
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = isControlled ? Boolean(open) : innerOpen;

  // 保持最新值但不进依赖数组：否则每次父组件渲染都会重注册协作句柄。
  const initialValuesRef = useRef(initialValues);
  initialValuesRef.current = initialValues;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

  /** create-form 拿不到时的兜底可写字段集（与服务端白名单一致）。 */
  const fallbackEditableFields = useMemo(
    () => [
      'username',
      'email',
      'phone',
      'realName',
      'nickname',
      'gender',
      'birthDate',
      'status',
      'deptIds',
      'roleIds',
    ],
    [],
  );

  const readValues = useCallback((): Record<string, unknown> => {
    const instance = formRef.current;
    if (!instance) return { ...valuesRef.current };
    try {
      const live = instance.getFieldsValue?.(true) as Record<string, unknown> | undefined;
      return { ...valuesRef.current, ...(live ?? {}) };
    } catch {
      // destroyOnHidden 之后 form 实例可能已经断开；退回最后一次已知值。
      return { ...valuesRef.current };
    }
  }, []);

  const draftFields = useCallback((): DraftFields => {
    const live = readValues();
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(live)) {
      if (key === 'password') continue;
      if (value === undefined || value === null || value === '') continue;
      out[key] = value;
    }
    return out as DraftFields;
  }, [readValues]);

  const buildSnapshot = useCallback((): UserFormSnapshot => {
    const provenance = provenanceRef.current;
    const dirtyFields = Object.entries(draftFields())
      .filter(([key]) => provenance[key] === 'user')
      .map(([key]) => key);
    return {
      target: USER_FORM_ASSISTANCE_TARGET,
      instanceId: instanceIdRef.current,
      revision: revisionRef.current,
      fields: draftFields(),
      dirtyFields,
    };
  }, [draftFields]);

  const setOpen = useCallback(
    (next: boolean) => {
      const wasOpen = openRef.current;
      if (!isControlled) setInnerOpen(next);
      openRef.current = next;
      // 只在「关 → 开」这一次跃迁上铸新实例：ModalForm 自己也会回吐一次
      // onOpenChange(true)，那不是一次新的打开。
      if (next && !wasOpen) {
        // 打开瞬间记录焦点持有者（通常是「新建」按钮）：关闭助手后焦点回到这里，
        // 而不是靠 CSS 选择器去找某个类名（设计 §5）。
        const active = typeof document === 'undefined' ? null : document.activeElement;
        returnFocusRef.current = active instanceof HTMLElement ? active : null;
        notifyUserFormOverlay();
        // 每次打开都是新实例：迟到的补丁因此不会落在一个已经被关闭过的表单上。
        openCountRef.current += 1;
        instanceIdRef.current = `${USER_FORM_ASSISTANCE_TARGET}#${openCountRef.current}`;
        revisionRef.current = 0;
        provenanceRef.current = {};
        valuesRef.current = { ...initialValuesRef.current };
        delete (valuesRef.current as Record<string, unknown>).password;
        const editId = initialValuesRef.current?.id;
        if (editId) void fetchUserDetail(Number(editId));
      }
      onOpenChangeRef.current?.(next);
      if (isEdit) {
        // 只在编辑表单**打开的那一刻**作废创建协作句柄：助手不能把「创建」意图
        // 写进一个编辑表单（设计 §3.2）。
        if (next && !wasOpen) {
          invalidateUserCreateFormHandle('edit-form-open');
        } else if (!next && wasOpen) {
          // 关掉顶替者时，创建表单可能仍旧开在底层 —— 归还前台，让它重新注册。
          // 不这么做的话它的注册 effect 依赖稳定，永远等不到恢复时机。
          restoreUserCreateFormHandle('edit-form-closed');
        }
      }
    },
    [isControlled, isEdit],
  );

  /**
   * 部门变化后**重新验证**角色：候选被服务端按新的 deptIds 重算过，
   * 因此已选角色可能不再可授予。这里不替用户改选，只把不可授予的标成错误，
   * 由用户自己决定（设计 §7）。服务端提交时仍会再检查一次。
   *
   * 返回失效的角色 id 列表：助手路径需要把它当成补丁结果的一部分回报，
   * 不能只在表单上留一个错误就完事 —— 调用方看不到自己的选择已经不可授予。
   */
  const revalidateRoles = useCallback(
    async (deptIds: number[]): Promise<number[]> => {
      if (!assistEnabled) return [];
      const options = await getUserCreateOptions({ deptIds });
      if (!options) return [];
      const allowed = new Set(options.roles.map((role) => role.id));
      const selected = (readValues().roleIds as number[] | undefined) ?? [];
      const invalid = selected.filter((id) => !allowed.has(id));
      if (invalid.length === 0) return [];
      formRef.current?.setFields?.([
        {
          name: 'roleIds',
          errors: ['所选角色在当前部门下不再可授予，请重新选择'],
        },
      ]);
      revisionRef.current += 1;
      return invalid;
    },
    [assistEnabled, readValues],
  );

  const writeFields = useCallback((patch: Record<string, unknown>) => {
    if (Object.keys(patch).length === 0) return;
    formRef.current?.setFieldsValue?.(patch);
    valuesRef.current = { ...valuesRef.current, ...patch };
    for (const key of Object.keys(patch)) provenanceRef.current[key] = 'assistant';
    revisionRef.current += 1;
  }, []);

  // ---- 协作契约注册：挂载即注册，卸载即摘除（身份变化时引用自动作废） ----
  useEffect(() => {
    if (!assistEnabled) return;
    const handle = {
      snapshot: buildSnapshot,
      open: async () => {
        if (!openRef.current) {
          setCollaborationRendered(true);
          setOpen(true);
          // 等一拍让 ModalForm 真正挂载 form 实例再返回快照。
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        return buildSnapshot();
      },
      apply: async (input: {
        instanceId: string;
        baseRevision: number;
        fields: Partial<UserCreateDraftFields>;
        authorizedFields?: readonly string[];
      }) => {
        // 已被编辑用户表单顶替：创建意图不再往任何底层表单里写（设计 §3.2）。
        if (!isCurrentUserCreateFormHandle(handle)) {
          return { applied: false, conflicts: [APPLY_CONFLICT.target] };
        }
        if (input.instanceId !== instanceIdRef.current) {
          return { applied: false, conflicts: [APPLY_CONFLICT.instance] };
        }
        if (!openRef.current) {
          return { applied: false, conflicts: [APPLY_CONFLICT.closed] };
        }
        // 版本检查放在最前面：确认暂停期间用户又手改时，迟到的补丁必须被拒。
        if (input.baseRevision !== revisionRef.current) {
          return { applied: false, conflicts: [APPLY_CONFLICT.revision] };
        }
        const editable = new Set(
          createFormRef.current?.editableFields ?? fallbackEditableFields,
        );
        const authorized = new Set(input.authorizedFields ?? []);
        const current = draftFields();
        const provenance = provenanceRef.current;
        const accepted: Record<string, unknown> = {};
        const conflicts: string[] = [];
        for (const [key, value] of Object.entries(input.fields ?? {})) {
          // 不可编辑字段（含 password）在**入口**就拒掉，服务端仍会再检查一次。
          if (!editable.has(key)) {
            conflicts.push(key);
            continue;
          }
          const userOwned = provenance[key] === 'user' && current[key] !== undefined;
          if (userOwned && !authorized.has(key)) {
            conflicts.push(key);
            continue;
          }
          accepted[key] = value;
        }
        if (conflicts.length > 0) return { applied: false, conflicts };
        writeFields(accepted);
        // `setFieldsValue` 不触发 `onValuesChange`，助手写入的 deptIds 必须在这里
        // 自己补一次角色重校验。并且要**等到它落定**再 resolve：重校验会 +1 版本，
        // 不等的话助手紧接着 snapshot() 拿到的就是半途版本，下一版补丁会被
        // __revision__ 拒掉 —— 用户明明什么都没动。
        const nextDeptIds = accepted.deptIds as number[] | undefined;
        if (nextDeptIds === undefined) return { applied: true, conflicts: [] };
        const invalidRoles = await revalidateRoles(nextDeptIds);
        // 补丁本身写成功了（deptIds 已落），但它让已选角色变得不可授予：
        // 把它作为 roleIds 冲突回报，助手据此让用户重新选，而不是静默留一个表单错误。
        return { applied: true, conflicts: invalidRoles.length > 0 ? ['roleIds'] : [] };
      },
    };
    const unsubscribe = registerUserCreateFormHandle(handle, identity);
    // 编辑表单关掉后创建表单要能**自己回来**：注册 effect 的依赖稳定，
    // 没有这次通知它永远等不到恢复时机。
    const unsubscribeTarget = subscribeUserCreateFormTarget((event) => {
      if (event !== 'restored') return;
      if (!assistEnabled || !openRef.current) return;
      registerUserCreateFormHandle(handle, identity);
    });
    return () => {
      unsubscribeTarget();
      unsubscribe();
    };
  }, [assistEnabled, buildSnapshot, draftFields, fallbackEditableFields, identity, setOpen, writeFields]);

  // ---- 浮层 / 焦点协作（设计 §4）：只声明状态，不给助手任何业务能力 ----
  // 读取器读取最新开关与焦点目标，因此表单每次开合不必反推通知助手；
  // 只有「注册/注销」这一次跃迁会 emit。
  useEffect(() => {
    if (!assistEnabled) return;
    const read = (): UserFormOverlayInfo => {
      const openNow = openRef.current;
      // 容器用 Ant Design 自己的类名定位：这是**表单内部**的层级记账，
      // 不是交给模型的操作通道（设计 §5 禁止的是助手侧的 CSS 选择器/模拟点击）。
      const container = openNow
        ? typeof document === 'undefined'
          ? null
          : (document.querySelector('.ant-modal-wrap .ant-modal-content') as HTMLElement | null)
        : null;
      return {
        target: USER_FORM_ASSISTANCE_TARGET,
        open: openNow,
        container,
        returnFocusTarget: openNow ? returnFocusRef.current : null,
      };
    };
    return registerUserFormOverlay(read);
  }, [assistEnabled]);

  // Esc 协调：只有当焦点在助手面板里时才拦下这次按键，
  // 因此「关助手」不会连带关掉未保存的业务表单（设计 §4）。
  useCoordinatedFormFocus(assistEnabled && isOpen);

  // ---- 既有一次性预填：现在灌进**同一个**表单，而不是另挂一个表单 ----
  useEffect(() => {
    if (!assistEnabled) return;
    const consume = () => {
      const next = consumeAiPrefill(USER_FORM_ASSISTANCE_TARGET);
      if (!next) return;
      const fields = { ...next.fields } as Record<string, unknown>;
      // 模型给 deptId，表单字段是 deptIds（多选）。
      if (fields.deptId !== undefined) {
        fields.deptIds = [fields.deptId as number];
        delete fields.deptId;
      }
      setPrefillMissing(next.missing);
      setOpen(true);
      writeFields(fields);
      // 同理：预填写进来的 deptIds 也要补一次角色重校验（setFieldsValue 不触发
      // onValuesChange）。预填不是补丁，没有返回值契约，因此不 await。
      const nextDeptIds = fields.deptIds as number[] | undefined;
      if (nextDeptIds !== undefined) void revalidateRoles(nextDeptIds);
    };
    consume();
    return subscribeAiPrefill(consume);
  }, [assistEnabled, revalidateRoles, setOpen, writeFields]);

  // 同源字段定义：约束、必填、白名单都以服务端 create schema 为准。
  useEffect(() => {
    if (!assistEnabled) return;
    let cancelled = false;
    void getUserCreateForm().then((form) => {
      if (!cancelled && form) setCreateForm(form);
    });
    return () => {
      cancelled = true;
    };
  }, [assistEnabled]);

  // 获取用户详情
  const fetchUserDetail = async (id: number) => {
    const res = await getUserDetail({ id });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue(res.data);
    }
  };

  // 同源约束：把 create-form 的 required/maxLength/pattern 用到真实表单上。
  const rulesFor = useCallback(
    (name: string) => {
      const field = createForm?.fields.find((item) => item.name === name);
      if (!field) return undefined;
      const constraints = field.constraints ?? {};
      const rules: Exclude<FormItemProps['rules'], undefined> = [];
      if (field.required) rules.push({ required: true, message: `请输入${field.label}` });
      if (typeof constraints.maxLength === 'number') rules.push({ max: constraints.maxLength });
      if (typeof constraints.minLength === 'number') rules.push({ min: constraints.minLength });
      if (typeof constraints.pattern === 'string') {
        try {
          rules.push({ pattern: new RegExp(constraints.pattern) });
        } catch {
          // 服务端正则不可编译时忽略它，仍然由必填与长度约束把关。
        }
      }
      if (name === 'email' || constraints.format === 'email') {
        rules.push({ type: 'email', message: '邮箱格式不正确' });
      }
      return rules.length > 0 ? rules : undefined;
    },
    [createForm],
  );

  /** 同源部门候选；拿不到时退回空树（用户仍可手输既有值，提交时服务端再校验）。 */
  const deptTreeRequest = useCallback(async () => {
    const options = await getUserCreateOptions({ deptIds: readValues().deptIds as number[] | undefined });
    return options?.departments ?? [];
  }, [readValues]);

  /**
   * 同源枚举候选：可选值来自 create-form 的 `enum` 约束，字典只负责提供**标签**。
   * 约束缺失时退回字典 —— 视觉结果不变（标签一律取自字典，没有标签才退回编码）。
   */
  const enumOptions = useCallback(
    (name: string, fallback: { label: string; value: string }[]) => {
      const field = createForm?.fields.find((item) => item.name === name);
      const values = field?.constraints?.enum;
      if (!Array.isArray(values) || values.length === 0) return fallback;
      return values.map((raw) => {
        const value = String(raw);
        const label = fallback.find((item) => item.value === value)?.label ?? value;
        return { label, value };
      });
    },
    [createForm],
  );

  const genderOptions = enumOptions('gender', genderDict);
  const userStatusOptions = enumOptions('status', userStatusDict);

  type UserFormValues = Partial<SystemAPI.createUserReq> & Partial<SystemAPI.updateUserReq>;

  const handleFinish = async (values: UserFormValues) => {
    const basePayload: SystemAPI.updateUserReq = {
      username: values.username,
      realName: values.realName,
      nickname: values.nickname,
      email: values.email,
      phone: values.phone,
      gender: values.gender,
      status: values.status,
      birthDate: values.birthDate,
      deptIds: values.deptIds,
      roleIds: values.roleIds,
    };

    if (!initialValues?.id) {
      const payload: SystemAPI.createUserReq = {
        ...basePayload,
        phone: values.phone ?? '',
        password: values.password ?? '',
      };
      const res = await createUser(payload);
      if (res.success) {
        if (onFinish) await onFinish();
        return true;
      }
      return false;
    }

    const payload: SystemAPI.updateUserReq = { ...basePayload };
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

  // 供依赖 create-form 白名单的逻辑使用的兜底可写字段集。

  if (!trigger && open === undefined && !collaborationRendered) return null;

  return (
    <>
      {prefillMissing.length > 0 && (
        <Alert
          type="info"
          showIcon
          closable
          onClose={() => setPrefillMissing([])}
          style={{ marginBottom: 16 }}
          message="AI 已预填部分字段"
          description={`还需要你补充：${prefillMissing.join('、')}。这些字段不会由 AI 代填。`}
        />
      )}
      <ModalForm
        title={title}
        trigger={trigger}
        open={isOpen}
        autoFocusFirstInput
        modalProps={{ destroyOnHidden: true, mask: { closable: false } }}
        grid
        formRef={formRef}
        initialValues={initialValues}
        onFinish={handleFinish}
        onValuesChange={(changed) => {
          for (const key of Object.keys(changed ?? {})) {
            provenanceRef.current[key] = 'user';
          }
          valuesRef.current = { ...valuesRef.current, ...(changed as Record<string, unknown>) };
          revisionRef.current += 1;
          const nextDeptIds = (changed as Record<string, unknown>).deptIds as number[] | undefined;
          if (nextDeptIds !== undefined) void revalidateRoles(nextDeptIds);
        }}
        onOpenChange={setOpen}
      >
      <ProFormText
        name="username"
        label="登录名称"
        placeholder="请输入登录名称"
        colProps={{ span: 12 }}
        rules={rulesFor('username')}
        fieldProps={{
          autoComplete: 'off'
        }}
      />

      <ProFormDeptTreeSelect
        name="deptIds"
        label="归属部门"
        placeholder="请选择归属部门"
        allowClear
        colProps={{ span: 12 }}
        {...(assistEnabled ? { request: deptTreeRequest } : {})}
      />

      <ProFormText
        name="phone"
        label="手机号码"
        placeholder="请输入手机号"
        rules={rulesFor('phone') ?? [{ required: true, message: "请输入手机号" }, { max: 11 }]}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="email"
        label="邮箱"
        placeholder="请输入邮箱"
        rules={rulesFor('email')}
        colProps={{ span: 12 }}
      />

      <ProFormText
        name="realName"
        label="真实姓名"
        placeholder="请输入真实姓名"
        rules={rulesFor('realName') ?? [{ min: 1, max: 50, message: "真实姓名长度不能超过50个字符" }]}
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="nickname"
        label="用户昵称"
        placeholder="请输入用户昵称"
        rules={rulesFor('nickname') ?? [{ min: 1, max: 50, message: "用户昵称长度必须在1到50个字符之间" }]}
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
        options={genderOptions}
        colProps={{ span: 12 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        options={userStatusOptions}
        colProps={{ span: 12 }}
      />

      <ProFormSelect
        name="roleIds"
        label="角色"
        placeholder="请选择角色"
        showSearch
        debounceTime={200}
        request={async (params) => {
          if (assistEnabled) {
            // 同源候选：角色按当前 deptIds 重算，不另建一套选项权限。
            const options = await getUserCreateOptions({
              deptIds: (readValues().deptIds as number[] | undefined) ?? [],
              keyword: params.keyWords,
            });
            return (options?.roles ?? []).map((role) => ({
              label: role.name,
              value: role.id,
            }));
          }
          const res = await getRoleList({
            page: 1,
            pageSize: 100,
            status: "1",
            keyword: params.keyWords,
            sortBy: "createdAt",
            sortOrder: "desc",
          });
          return (res.data || []).map((r: SystemAPI.sysRole) => ({
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

    </ModalForm>
    </>
  );
};

export default UserForm;
