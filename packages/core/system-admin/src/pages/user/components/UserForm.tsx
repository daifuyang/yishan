import type {} from '../../../types/index';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ModalForm,
  type ProFormInstance,
  ProFormText,
  ProFormRadio,
  ProFormDatePicker,
  ProFormSelect,
  ProForm,
} from "@ant-design/pro-components";
import { Alert, Col, type FormItemProps } from "antd";
import { useSystemAdmin } from "../../../runtime";
import { getRoleList } from "../../../services/generated/sysRoles";
import {
  getUserDetail,
  createUser,
  updateUser,
  getUserCreateForm as requestUserCreateForm,
  getUserCreateOptions as requestUserCreateOptions,
} from "../../../services/generated/sysUsers";
import { ProFormDeptTreeSelect } from "../../../components/DeptTreeSelect";
import { AttachmentSelect } from "../../../components/AttachmentSelect";
import {
  APPLY_CONFLICT,
  invalidateUserCreateFormHandle,
  isCurrentUserCreateFormHandle,
  notifyUserFormOverlay,
  peekUserCreateDraftLink,
  publishUserCreateFormChange,
  registerUserCreateFormHandle,
  registerUserFormOverlay,
  restoreUserCreateFormHandle,
  subscribeUserCreateFormTarget,
  useCoordinatedFormFocus,
  USER_FORM_ASSISTANCE_TARGET,
  type UserCreateDraftFields,
  type UserCreateDraftSubmission,
  type UserFormOverlayInfo,
  type UserFormSnapshot,
} from "../../../form-assistance";
import {
  consumeAiPrefill,
  subscribeAiPrefill,
  registerAiPrefillHandler,
  publishAiPrefillResult,
  type AiPrefill,
} from "../../../ai-prefill";

/**
 * 同源字段定义与候选，**直接来自生成的客户端**。
 *
 * 这里只做「拆信封 + 失败退回 null」这一件事，不再维护任何一份字段表：约束、必填、
 * 白名单的唯一来源是后端从真实 create schema 派生的定义（Task 3）。曾经存在过一份
 * 手写的 `services/user-create-form.ts`，它与生成客户端是同一组端点的两份真相，
 * 已在 Task 10 删除。
 */
type UserCreateForm = SystemAPI.userCreateFormResp['data'];
type UserCreateOptions = SystemAPI.userCreateOptionsResp['data'];

async function getUserCreateForm(): Promise<UserCreateForm | null> {
  try {
    const response = await requestUserCreateForm();
    return response?.success && response.data ? response.data : null;
  } catch {
    return null;
  }
}

async function getUserCreateOptions(query: SystemAPI.getUserCreateOptionsParams): Promise<UserCreateOptions | null> {
  try {
    const response = await requestUserCreateOptions(query);
    return response?.success && response.data ? response.data : null;
  } catch {
    return null;
  }
}

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
  aiPrefill?: { requestId?: string; fields: Record<string, unknown> };
}

/** 协作 `open()` 等待 ModalForm 挂载 form 实例的上限（次数 × 间隔 ≈ 320ms）。 */
const FORM_MOUNT_TICKS = 20;
const FORM_MOUNT_TICK_MS = 16;

type DraftFields = UserCreateDraftFields & Record<string, unknown>;

const UserForm: React.FC<UserFormProps> = ({
  title,
  trigger,
  initialValues = { status: "1", gender: "0" },
  onFinish,
  open,
  onOpenChange,
  assistance,
  aiPrefill,
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
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const requestIdRef = useRef<string | undefined>(undefined);
  const aiPrefillRef = useRef(aiPrefill);
  aiPrefillRef.current = aiPrefill;
  const pendingFieldsRef = useRef<Record<string, unknown>>({});
  const detailLoadingRef = useRef(false);

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
      if (!fallbackEditableFields.includes(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      out[key] = value;
    }
    return out as DraftFields;
  }, [fallbackEditableFields, readValues]);

  const safePrefillFields = useCallback((fields: Readonly<Record<string, unknown>>) => {
    const normalized = { ...fields };
    if (normalized.deptId !== undefined) normalized.deptIds = [Number(normalized.deptId)];
    const editable = createFormRef.current?.editableFields ?? fallbackEditableFields;
    return Object.fromEntries(Object.entries(normalized).filter(([key]) =>
      fallbackEditableFields.includes(key) && editable.includes(key),
    ));
  }, [fallbackEditableFields]);

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

  /**
   * 把一次可见值变化推给产品侧（设计 §6：手动修改按字段合并同步到草稿）。
   *
   * 推的是快照，密码不在里面；产品侧只能 PATCH 这些非敏感字段。表单关着时不推 ——
   * 一次「关闭」不是字段变化，让同步逻辑自己去判断表单是否还开着。
   */
  const notifyChange = useCallback(() => {
    if (!assistEnabled || !openRef.current) return;
    publishUserCreateFormChange(buildSnapshot());
  }, [assistEnabled, buildSnapshot]);

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
        requestIdRef.current = aiPrefillRef.current?.requestId;
        pendingFieldsRef.current = safePrefillFields(aiPrefillRef.current?.fields ?? {});
        submittingRef.current = false;
        const editId = initialValuesRef.current?.id;
        if (editId) void fetchUserDetail(Number(editId));
        notifyChange();
      }
      if (!next) {
        openCountRef.current += 1;
        pendingFieldsRef.current = {};
        detailLoadingRef.current = false;
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
    [isControlled, isEdit, notifyChange, safePrefillFields],
  );

  /**
   * 部门变化后**重新验证**角色：候选被服务端按新的 deptIds 重算过，
   * 因此已选角色可能不再可授予。这里不替用户改选，只把不可授予的标成错误，
   * 由用户自己决定（设计 §7）。服务端提交时仍会再检查一次。
   *
   * 返回失效的角色 id 列表：助手路径需要把它当成补丁结果的一部分回报，
   * 不能只在表单上留一个错误就完事 —— 调用方看不到自己的选择已经不可授予。
   *
   * `bumpRevision` 默认 true，但**手改路径必须传 false**：`onValuesChange` 已经在
   * 同一次事件里同步 +1 过版本（那才是这次用户动作的版本推进）；这里再补一次会在
   * 网络返回后才发生，于是「用户改部门 → 助手紧接着读快照」拿到的是旧版本，
   * 下一版补丁被 __revision__ 拒掉——而用户明明刚动过手。助手 `open()` 路径相反：
   * `setFieldsValue` 不触发 `onValuesChange`，那次 +1 是唯一一次，必须由本函数补。
   */
  const revalidateRoles = useCallback(
    async (deptIds: number[], settings: { bumpRevision?: boolean } = {}): Promise<number[]> => {
      if (!assistEnabled) return [];
      const options_ = await getUserCreateOptions({ deptIds });
      if (!options_) return [];
      const allowed = new Set(options_.roles.map((role) => role.id));
      const selected = (readValues().roleIds as number[] | undefined) ?? [];
      const invalid = selected.filter((id) => !allowed.has(id));
      if (invalid.length === 0) return [];
      formRef.current?.setFields?.([
        {
          name: 'roleIds',
          errors: ['所选角色在当前部门下不再可授予，请重新选择'],
        },
      ]);
      if (settings.bumpRevision !== false) revisionRef.current += 1;
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
    // 助手写入的字段同样以表单为准（设计 §6），因此也要让同步逻辑看到它们。
    notifyChange();
  }, [notifyChange]);

  const applyPrefill = useCallback(async (request: AiPrefill) => {
    const generation = openCountRef.current;
    const owner = identityRef.current;
    const fields = safePrefillFields(request.fields);
    requestIdRef.current = request.requestId;
    pendingFieldsRef.current = { ...pendingFieldsRef.current, ...fields };
    for (let tick = 0; tick < FORM_MOUNT_TICKS; tick += 1) {
      if (!openRef.current || generation !== openCountRef.current || owner !== identityRef.current) return;
      if (formRef.current && !detailLoadingRef.current) {
        writeFields(fields);
        const deptIds = fields.deptIds as number[] | undefined;
        if (deptIds !== undefined) void revalidateRoles(deptIds, { bumpRevision: false });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, FORM_MOUNT_TICK_MS));
    }
  }, [revalidateRoles, safePrefillFields, writeFields]);

  useEffect(() => {
    return registerAiPrefillHandler(isEdit ? 'user.update' : 'user.create', (request) => {
      if (!openRef.current) return false;
      if (isEdit && Number(request.fields.id) !== Number(initialValuesRef.current.id)) return false;
      setPrefillMissing(request.missing);
      void applyPrefill(request);
      return true;
    });
  }, [applyPrefill, isEdit, identity]);

  useEffect(() => () => {
    openCountRef.current += 1;
    openRef.current = false;
  }, [identity]);

  // ---- 协作契约注册：挂载即注册，卸载即摘除（身份变化时引用自动作废） ----
  useEffect(() => {
    if (!assistEnabled) return;
    const handle = {
      snapshot: buildSnapshot,
      open: async () => {
        if (!openRef.current) {
          setCollaborationRendered(true);
          setOpen(true);
          // **必须等到 form 实例真的挂上**，不能只等一拍：`writeFields` 用的是
          // `formRef.current?.setFieldsValue?.()`，实例还没挂上时它会静默跳过 ——
          // 补丁「已套用」，界面却一个字都没填进去，而回执还说「已填入」。
          // antd Modal 在真实浏览器里要等一次挂载提交（jsdom 同步挂载，掩盖了这个竞态），
          // 所以这里有界轮询，兜底仍然返回快照让 `apply` 按既有冲突规则处理。
          for (let tick = 0; tick < FORM_MOUNT_TICKS; tick += 1) {
            if (formRef.current) break;
            await new Promise((resolve) => setTimeout(resolve, FORM_MOUNT_TICK_MS));
          }
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
      return {
        target: USER_FORM_ASSISTANCE_TARGET,
        open: openNow,
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
      setPrefillMissing(next.missing);
      setCollaborationRendered(true);
      setOpen(true);
      void applyPrefill(next);
    };
    consume();
    return subscribeAiPrefill(consume);
  }, [applyPrefill, assistEnabled, setOpen]);

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
    const generation = openCountRef.current;
    const owner = identityRef.current;
    detailLoadingRef.current = true;
    try {
      const res = await getUserDetail({ id });
      for (let tick = 0; tick < FORM_MOUNT_TICKS && !formRef.current; tick += 1) {
        if (!openRef.current || generation !== openCountRef.current || owner !== identityRef.current) return;
        await new Promise((resolve) => setTimeout(resolve, FORM_MOUNT_TICK_MS));
      }
      if (!openRef.current || generation !== openCountRef.current || owner !== identityRef.current) return;
      if (res.success && res.data) {
        const userFields = Object.fromEntries(Object.entries(readValues()).filter(([key]) => provenanceRef.current[key] === 'user'));
        const fields = { ...res.data, ...pendingFieldsRef.current, ...userFields };
        formRef.current?.setFieldsValue(fields);
        valuesRef.current = { ...valuesRef.current, ...fields };
      }
    } finally {
      if (generation === openCountRef.current && owner === identityRef.current) detailLoadingRef.current = false;
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

  /**
   * 提交期本地锁。
   *
   * 幂等的**真正**保证在服务端事务里（同一草稿最多完成一次创建）；这里只是挡住双击。
   * 锁不释放是刻意的：失败时用户必须重新看一眼表单再点「确定」。
   */
  const submittingRef = useRef(false);
  /**
   * 「确定」被拒绝的原因。
   *
   * 草稿联动可能**硬失败**（草稿表单已关闭、同步没落定），此时既不能降级成一次
   * 没有草稿关联的创建，也必须让用户看到为什么没创建 —— 静默返回 false 等于让
   * 人对着没反应的按钮反复点。
   */
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFinish = async (values: UserFormValues) => {
    const requestId = requestIdRef.current;
    const report = (status: 'completed' | 'failed') => {
      if (!requestId) return;
      const operation = isEdit ? '修改' : '创建';
      publishAiPrefillResult({
        requestId,
        status,
        message: status === 'completed'
          ? `用户${operation}成功`
          : `用户${operation}失败，请在表单中检查后重试`,
      });
    };
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
      avatar: values.avatar,
    };

    if (!initialValues?.id) {
      if (submittingRef.current) return false;
      submittingRef.current = true;
      setSubmitError(null);
      // 草稿联动：先把待同步的非敏感字段落地，再取**精确**版本号带上。
      // 没有草稿时 `prepare()` 返回 null，普通创建路径与从前完全一致。
      const link = peekUserCreateDraftLink();
      let submission: UserCreateDraftSubmission | null = null;
      try {
        submission = link ? await link.prepare() : null;
      } catch (cause) {
        // 同步失败**不**降级成一次没有草稿关联的创建：那会绕开「同一草稿只完成一次
        // 创建」的约束，也等于把用户的确认当成无关的一次普通创建。
        // 但必须把原因摆出来 —— 静默返回 false 会让人对着没反应的按钮一直点。
        const reason = cause instanceof Error ? cause.message : '草稿联动未成功';
        // 只取这句人话：错误对象里可能夹带请求细节，这里不整段外显。
        setSubmitError(reason);
        report('failed');
        submittingRef.current = false;
        return false;
      }
      // `draftSubmission` 已在后端 schema 上（Task 5），生成的客户端要到 Task 10 才带上，
      // 因此这里显式声明一次并断言传入 —— Task 10 之后类型自动跟随，无需改动。
      type CreateUserPayload = SystemAPI.createUserReq & {
        draftSubmission?: UserCreateDraftSubmission;
      };
      const payload: CreateUserPayload = {
        ...basePayload,
        phone: values.phone ?? '',
        // 密码只存在于这个受保护的控件与这一次请求里：不进草稿、不进日志、不进审计。
        password: values.password ?? '',
        ...(submission ? { draftSubmission: submission } : {}),
      };
      try {
        const res = await createUser(payload as SystemAPI.createUserReq);
        if (res.success) {
          report('completed');
          if (onFinish) await onFinish();
          return true;
        }
        // 明确的业务失败：保留表单数据与密码控件（返回 false，不清空、不关闭），
        // 由用户改完再点一次。
        submittingRef.current = false;
        report('failed');
        setSubmitError('用户创建失败，请检查表单后重试');
        return false;
      } catch {
        // 响应可能已经丢了。**绝不自动重发创建**（设计 §11）：只把草稿当前状态读回来，
        // 成功就展示成功，仍在提交中就继续核对，明确失败才允许用户再次点击。
        if (link) {
          const outcome = await link.reconcile();
          if (outcome === 'completed') {
            report('completed');
            if (onFinish) await onFinish();
            return true;
          }
        }
        submittingRef.current = false;
        report('failed');
        setSubmitError('用户创建失败，请检查表单后重试');
        return false;
      }
    }

    const payload: SystemAPI.updateUserReq = { ...basePayload };
    if (values.password && String(values.password).trim().length > 0) {
      payload.password = values.password;
    }
    try {
      const res = await updateUser({ id: Number(initialValues.id) }, payload);
      if (res.success) {
        report('completed');
        if (onFinish) await onFinish();
        return true;
      }
    } catch {
      // 保留当前表单供用户检查并重试。
    }
    report('failed');
    setSubmitError('用户修改失败，请检查表单后重试');
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
        rowProps={{ style: { marginInline: 0 } }}
        formRef={formRef}
        initialValues={initialValues}
        onFinish={handleFinish}
        onValuesChange={(changed) => {
          setSubmitError(null);
          for (const key of Object.keys(changed ?? {})) {
            provenanceRef.current[key] = 'user';
          }
          valuesRef.current = { ...valuesRef.current, ...(changed as Record<string, unknown>) };
          revisionRef.current += 1;
          // 用户手改推给产品侧合并同步；快照已剔除密码，因此同步负载里不会有它。
          notifyChange();
          const nextDeptIds = (changed as Record<string, unknown>).deptIds as number[] | undefined;
          // 不 bumpRevision：上面那次同步 +1 已经是这次用户动作的版本推进。
          // 这里再补一次会晚于网络返回，让助手读到过期快照而拒掉下一版补丁。
          if (nextDeptIds !== undefined) void revalidateRoles(nextDeptIds, { bumpRevision: false });
        }}
        onOpenChange={setOpen}
      >
      {submitError ? (
        <Alert type="error" showIcon message={submitError} style={{ marginBottom: 16 }} />
      ) : null}
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

      <Col span={12}>
        <ProForm.Item name="avatar" label="头像">
          <AttachmentSelect kind="image" multiple={false} maxCount={1} />
        </ProForm.Item>
      </Col>

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
        fieldProps={{ style: { width: "100%" }, previewValue: false }}
        colProps={{ span: 12 }}
      />

    </ModalForm>
    </>
  );
};

export default UserForm;
