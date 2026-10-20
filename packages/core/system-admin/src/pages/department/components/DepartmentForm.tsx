import type {} from '../../../types/index';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Button } from 'antd';
import type { ProFormInstance } from '@ant-design/pro-components';
import {
  APPLY_CONFLICT,
  useAiForm,
  isCurrentUserCreateFormHandle,
  publishUserCreateFormChange,
  peekUserCreateDraftLink,
  requestNativeFormAssistance,
  type UserCreateFormHandle,
  useCoordinatedFormFocus,
} from '../../../form-assistance';
import {
  ModalForm,
  ProFormText,
  ProFormRadio,
  ProFormDigit,
  ProFormTextArea,
  ProFormTreeSelect,
} from '@ant-design/pro-components';
import {
  getDeptTree,
  createDept,
  updateDept,
  getDeptDetail,
} from '../../../services/generated/sysDepts';
import { useSystemAdmin } from '../../../runtime';
import {
  consumeAiPrefill,
  registerAiPrefillHandler,
  subscribeAiPrefill,
  publishAiPrefillResult,
  type AiPrefill,
} from '../../../ai-prefill';

export interface DepartmentFormProps {
  title: string;
  assistance?: 'department.create';
  trigger?: React.JSX.Element;
  initialValues?: Partial<SystemAPI.sysDept>;
  onFinish?: () => Promise<void>;
  /** 受控开关。AI 预填命中时用它直接弹表单，此时不需要 trigger。 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const topDepartment = {
  id: 0,
  name: '顶级部门',
  status: '1' as '0' | '1',
  sort_order: 0,
  createdAt: '',
  updatedAt: '',
  children: [],
};

const DepartmentForm: React.FC<DepartmentFormProps> = ({
  title,
  trigger,
  initialValues = {
    parentId: 0,
    status: '1',
  },
  onFinish,
  open,
  onOpenChange,
  assistance,
}) => {
  const { initialState } = useSystemAdmin();
  const formRef = useRef<ProFormInstance<SystemAPI.createDeptReq> | undefined>(
    undefined,
  );
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open === undefined ? innerOpen : open;
  const openRef = useRef(false);
  const revision = useRef(0);
  const instance = useRef('');
  const generation = useRef(0);
  const owned = useRef(new Set<string>());
  const pending = useRef<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const assistEnabled = assistance === 'department.create' && !initialValues.id;
  const fields = [
    'name',
    'parentId',
    'status',
    'sort_order',
    'description',
    'leaderId',
  ];
  const values = () => ({
    ...pending.current,
    ...formRef.current?.getFieldsValue(true),
  });
  const snapshot = useCallback(
    () => ({
      target: 'department.create' as const,
      instanceId: openRef.current ? instance.current : '',
      revision: revision.current,
      fields: Object.fromEntries(
        Object.entries(values()).filter(([key]) => fields.includes(key)),
      ),
      dirtyFields: [...owned.current],
    }),
    [],
  );
  const notify = () => {
    if (assistEnabled && openRef.current)
      publishUserCreateFormChange(snapshot());
  };
  const setOpen = (next: boolean) => {
    if (next && !openRef.current) {
      instance.current = 'department.create#' + ++generation.current;
      revision.current = 0;
      owned.current.clear();
      pending.current = {
        parentId: 0,
        status: '1',
        sort_order: 0,
        ...initialValues,
      };
      submitting.current = false;
      setError('');
    }
    openRef.current = next;
    if (!next) {
      generation.current += 1;
      instance.current = '';
    }
    if (open === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const assistanceHandle = useMemo(() => {
    if (!assistEnabled) return null;
    const handle: UserCreateFormHandle = {
      snapshot,
      open: async () => {
        setOpenRef.current(true);
        const version = generation.current;
        for (let tick = 0; tick < 20 && !formRef.current; tick += 1) {
          await new Promise((resolve) => setTimeout(resolve, 16));
          if (version !== generation.current || !openRef.current)
            return snapshot();
        }
        formRef.current?.setFieldsValue(pending.current);
        return snapshot();
      },
      apply: async (input) => {
        if (!isCurrentUserCreateFormHandle(handle))
          return { applied: false, conflicts: [APPLY_CONFLICT.target] };
        if (!openRef.current)
          return { applied: false, conflicts: [APPLY_CONFLICT.closed] };
        if (input.instanceId !== instance.current)
          return { applied: false, conflicts: [APPLY_CONFLICT.instance] };
        if (input.baseRevision !== revision.current)
          return { applied: false, conflicts: [APPLY_CONFLICT.revision] };
        const live = values();
        const conflicts = Object.keys(input.fields).filter(
          (key) =>
            !fields.includes(key) ||
            (owned.current.has(key) &&
              !input.authorizedFields?.includes(key) &&
              JSON.stringify(live[key]) !==
                JSON.stringify(input.fields[key as keyof typeof input.fields])),
        );
        if (conflicts.length) return { applied: false, conflicts };
        pending.current = { ...pending.current, ...input.fields };
        formRef.current?.setFieldsValue(input.fields);
        revision.current += 1;
        notify();
        return { applied: true, conflicts: [] };
      },
    };
    return handle;
  }, [assistEnabled, snapshot, initialState?.currentUser?.id]);
  useAiForm({
    handle: assistanceHandle,
    identity: initialState?.currentUser?.id,
  });
  useEffect(() => {
    const handle = assistanceHandle;
    if (!handle) return;
    const applyPrefill = async (request: AiPrefill) => {
      const opened = await handle.open();
      const fields = { ...request.fields };
      if ('sortOrder' in fields) {
        fields.sort_order = fields.sortOrder;
        delete fields.sortOrder;
      }
      const result = await handle.apply({
        instanceId: opened.instanceId,
        baseRevision: opened.revision,
        fields,
      });
      if (request.requestId)
        publishAiPrefillResult({
          requestId: request.requestId,
          status: result.applied ? 'notice' : 'failed',
          message: result.applied
            ? '已填入原生部门表单，请核对后保存。'
            : '你修改过的字段未被覆盖，请在表单中核对。',
        });
    };
    const unregisterPrefill = registerAiPrefillHandler(
      'department.create',
      (request) => {
        void applyPrefill(request);
        return true;
      },
    );
    const consume = () => {
      const request = consumeAiPrefill('department.create');
      if (request) void applyPrefill(request);
    };
    consume();
    const unsubscribe = subscribeAiPrefill(consume);
    return () => {
      unregisterPrefill();
      unsubscribe();
      generation.current += 1;
      openRef.current = false;
    };
  }, [assistanceHandle]);

  useCoordinatedFormFocus(assistEnabled && isOpen);
  useEffect(
    () => () => {
      generation.current += 1;
      openRef.current = false;
    },
    [initialState?.currentUser?.id],
  );
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> =
    dictDataMap.default_status || [];

  if (!trigger && open === undefined && !assistEnabled && !innerOpen)
    return null;

  return (
    <ModalForm
      formRef={formRef}
      width={520}
      title={title}
      trigger={trigger}
      open={isOpen}
      modalProps={{ destroyOnHidden: true, mask: { closable: false } }}
      autoFocusFirstInput
      grid
      initialValues={{
        parentId: 0,
        status: '1',
        sort_order: 0,
        ...initialValues,
      }}
      onValuesChange={(changed) => {
        for (const key of Object.keys(changed)) owned.current.add(key);
        pending.current = { ...pending.current, ...changed };
        revision.current += 1;
        notify();
      }}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen && initialValues?.id) {
          getDeptDetail({ id: Number(initialValues.id) }).then((res) => {
            if (res.success && res.data) {
              formRef.current?.setFieldsValue(res.data as any);
            }
          });
        }
      }}
      onFinish={async (values) => {
        const basePayload: SystemAPI.createDeptReq = {
          name: values.name || '',
          parentId: values.parentId === 0 ? undefined : values.parentId,
          status: values.status,
          sort_order: Number(values.sort_order ?? 0),
          description: values.description,
          leaderId: values.leaderId ? Number(values.leaderId) : undefined,
        };
        if (!initialValues?.id) {
          if (submitting.current) return false;
          submitting.current = true;
          setError('');
          const link = assistEnabled
            ? peekUserCreateDraftLink('department.create')
            : null;
          try {
            const submission = await link?.prepare();
            const res = await createDept({
              ...basePayload,
              ...(submission ? { draftSubmission: submission } : {}),
            });
            if (res.success) {
              link?.complete?.();
              await onFinish?.();
              return true;
            }
            submitting.current = false;
            setError('创建失败，请检查后重试');
            return false;
          } catch (cause) {
            if (link && (await link.reconcile()) === 'completed') {
              await onFinish?.();
              return true;
            }
            submitting.current = false;
            setError(
              cause instanceof Error
                ? cause.message
                : '保存结果未确认，请核对后重试',
            );
            return false;
          }
        }
        const updatePayload: SystemAPI.updateDeptReq = { ...basePayload };
        const res = await updateDept(
          { id: Number(initialValues.id) },
          updatePayload,
        );
        if (res.success) {
          await onFinish?.();
          return true;
        }
        return false;
      }}
    >
      {error && <Alert type="error" title={error} />}
      {assistEnabled && (
        <Button
          type="link"
          onClick={() => requestNativeFormAssistance('department.create')}
        >
          AI 辅助填写
        </Button>
      )}
      <ProFormTreeSelect
        name="parentId"
        label="上级部门"
        rules={[{ required: true, message: '请选择上级部门' }]}
        colProps={{ span: 24 }}
        request={async () => {
          try {
            const response = await getDeptTree();
            return [topDepartment, ...(response.data || [])];
          } catch {
            return [topDepartment];
          }
        }}
        fieldProps={{
          fieldNames: { label: 'name', value: 'id', children: 'children' },
          allowClear: true,
          treeDefaultExpandAll: true,
          style: { width: '100%' },
          showSearch: true,
        }}
      />

      <ProFormText
        name="name"
        label="部门名称"
        placeholder="请输入部门名称"
        rules={[
          { required: true, message: '请输入部门名称' },
          { max: 50, message: '最多50个字符' },
        ]}
        colProps={{ span: 24 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        rules={[{ required: true, message: '请选择状态' }]}
        options={defaultStatusDict.map((item) => ({
          label: item.label,
          value: item.value,
        }))}
        colProps={{ span: 24 }}
      />

      <ProFormDigit
        name="sort_order"
        label="排序"
        placeholder="请输入排序值"
        rules={[{ required: true, message: '请输入排序值' }]}
        fieldProps={{ min: 0 }}
        colProps={{ span: 24 }}
      />

      <ProFormTextArea
        name="description"
        label="部门描述"
        rules={[{ max: 200, message: '最多200个字符' }]}
        fieldProps={{ rows: 3, placeholder: '请输入部门描述（可选）' }}
        colProps={{ span: 24 }}
      />

      <ProFormDigit
        name="leaderId"
        label="负责人ID"
        placeholder="请输入负责人用户ID（可选）"
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default DepartmentForm;
