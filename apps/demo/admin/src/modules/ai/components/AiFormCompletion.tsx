import {
  peekAiFormCompletion,
  peekNativeFormOperation,
  type AiCompletionField,
  type AiFormCompletionHandle,
} from '@yishan/core-admin/form-assistance';
import { Alert, Button, Flex, Typography } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  getActionDraft,
  patchActionDraft,
  type ActionDraft,
  type ActionDraftCompletionField,
  type ActionDraftValidationError,
} from '../services/actionDraftService';
import { chatError } from '../services/chatError';

/**
 * AiFormCompletion — 草稿的**补全面板**。
 *
 * 它独立于工具卡片（工具卡片只记录「做了什么」），但与工具卡片**共享同一份草稿**：
 * 值以服务端草稿为准，工具执行成功**不等于**业务数据创建成功。
 *
 * 统一的补充流程：
 *
 * ```text
 * AI 收集已知信息 → 读业务 schema → 生成草稿 → 算缺失字段
 *   → 一次性展示全部待补全字段 → 用户填写 → 合并 + 校验
 *   → 用户确认 → 原有业务 API 正式创建
 * ```
 *
 * 三条边界：
 *
 * 1. **不执行任何 AI 工具**：这里只有草稿读写与一次业务提交。
 * 2. **不绕过业务 API**：正式创建由业务自己注册的 `submit` 走原有接口，
 *    服务端重新鉴权、重新校验，并保证一份草稿最多完成一次创建。
 * 3. **敏感值只在这里**：密码、头像由受保护的表单控件持有，只随这一次提交走，
 *    不进草稿、不进模型上下文、不进日志。
 */

/** 面板的阶段。刻意与工具执行状态分开：工具成功 ≠ 业务创建成功。 */
type CompletionStage =
  | 'loading'
  | 'editing'
  | 'confirming'
  | 'submitting'
  | 'done';

/** 草稿结束态：这些状态下的草稿不能再改，也不能再提交。 */
const CLOSED_STATUSES = new Set([
  'completed',
  'cancelled',
  'expired',
  'submitting',
]);

/** 服务端的待补全字段 → 面板使用的字段描述。 */
function toCompletionField(
  field: ActionDraftCompletionField,
): AiCompletionField {
  return {
    name: field.name,
    label: field.label,
    required: field.required,
    sensitive: field.sensitive,
    selector: field.selector,
    constraints: field.constraints ?? {},
    draftWritable: field.draftWritable,
    invalid: field.invalid,
  };
}

/**
 * 待补全字段。
 *
 * 首选服务端算好的 `completionFields`；拿不到时退回 `missingFields`
 * （只含必填项与「必须在表单里完成」的字段）—— 降级路径仍然**不会**让用户
 * 去重复填写已经给过的信息。
 */
function completionFieldsOf(draft: ActionDraft): AiCompletionField[] {
  if (draft.completionFields?.length) {
    return draft.completionFields.map(toCompletionField);
  }
  return draft.missingFields.map((field) => ({
    name: field.name,
    label: field.label,
    required: field.required,
    sensitive: Boolean(field.sensitive),
    selector: 'text',
    constraints: {},
    draftWritable: !field.mustCompleteInForm,
    invalid: false,
  }));
}

/** 能写进草稿的补丁值：只有标量与数字数组。 */
function patchable(
  value: unknown,
): string | number | number[] | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const numbers = value.filter(
      (item): item is number => typeof item === 'number' && Number.isFinite(item),
    );
    return numbers.length === value.length ? numbers : undefined;
  }
  return undefined;
}

export function AiFormCompletion({
  draftId,
  operationId,
}: {
  draftId: string;
  operationId: string;
}) {
  const registration = peekAiFormCompletion(operationId);
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [stage, setStage] = useState<CompletionStage>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [serverErrors, setServerErrors] = useState<ActionDraftValidationError[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const formRef = useRef<AiFormCompletionHandle>(null);
  /** 表单收集到的值（含密码、头像）：只随这一次提交走。 */
  const collectedRef = useRef<Record<string, unknown>>({});
  /** 提交守卫：重复点击不会发出第二次创建。 */
  const submittingRef = useRef(false);

  const load = useCallback(async () => {
    setStage('loading');
    setError('');
    try {
      const next = await getActionDraft(draftId);
      setDraft(next);
      setServerErrors([]);
      collectedRef.current = { ...next.formData };
      // 没有待补全字段 → 直接进入确认，不显示空表单。
      setStage(
        completionFieldsOf(next).length > 0 ? 'editing' : 'confirming',
      );
    } catch (cause) {
      setError(chatError(cause));
      setStage('editing');
    }
  }, [draftId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * 敏感值（密码）的生命周期：只在**这一次**表单里存在。
   *
   * 成功创建、面板卸载（换会话、关掉助手）都把它清掉；失败时保留，用户还能
   * 回到表单里改。它从不进草稿、不进模型上下文、不进日志。
   */
  useEffect(
    () => () => {
      collectedRef.current = {};
    },
    [],
  );

  const fields = draft ? completionFieldsOf(draft) : [];
  const values = draft?.formData ?? {};
  const closed = Boolean(draft && CLOSED_STATUSES.has(draft.status));
  const subject = peekNativeFormOperation(operationId)?.name ?? '';
  const CompletionForm = registration?.render;

  /** 「完成补充」：按原生规则校验 → 合并进草稿 → 重新校验。 */
  const complete = async () => {
    if (!draft || !registration || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    let collected: Record<string, unknown>;
    try {
      collected = (await formRef.current?.validate()) ?? {};
    } catch {
      // 校验没过：原生表单已经把错误显示在字段上，这里不再重复提示。
      setSaving(false);
      return;
    }
    const merged = { ...values, ...collected };
    collectedRef.current = merged;
    // 只把**能写进草稿**的字段补丁回去：密码、头像这类只随提交走一次。
    const patch: Record<string, string | number | number[]> = {};
    for (const field of fields) {
      if (!field.draftWritable) continue;
      const value = patchable(merged[field.name]);
      if (value === undefined) continue;
      patch[field.name] = value;
    }
    try {
      const updated = await patchActionDraft(
        draft.draftId,
        draft.draftVersion,
        patch,
      );
      setDraft(updated);
      setServerErrors(updated.validationErrors);
      if (updated.validationErrors.length > 0) {
        setNotice('还有字段需要修正，请修改后再提交。');
        setStage('editing');
        return;
      }
      setStage('confirming');
    } catch (cause) {
      setError(chatError(cause));
      setStage('editing');
    } finally {
      setSaving(false);
    }
  };

  /** 「确认创建」：此刻才调用原有业务创建接口。 */
  const confirm = async () => {
    if (!draft || !registration || submittingRef.current) return;
    submittingRef.current = true;
    setStage('submitting');
    setError('');
    try {
      const outcome = await registration.submit({
        draftId: draft.draftId,
        draftVersion: draft.draftVersion,
        values: { ...draft.formData, ...collectedRef.current },
      });
      if (outcome.ok) {
        setNotice(outcome.message ?? '创建成功');
        setStage('done');
        // 创建成功：敏感值就地丢弃，不留在内存里。
        collectedRef.current = {};
      } else {
        setError(outcome.message ?? '创建失败，请检查后重试');
        setStage('confirming');
      }
    } catch (cause) {
      setError(chatError(cause));
      setStage('confirming');
    } finally {
      submittingRef.current = false;
    }
  };

  if (!registration || !CompletionForm) {
    return (
      <Alert
        type="info"
        showIcon
        title="这份表单暂不支持在对话中补全"
        description="请到对应的业务页面填写并提交。"
      />
    );
  }

  return (
    <Flex vertical gap={12} style={{ width: '100%', minWidth: 0 }}>
      {error && <Alert type="error" showIcon title={error} />}
      {notice && stage !== 'done' && (
        <Alert type="warning" showIcon title={notice} />
      )}
      {closed && (
        <Alert
          type="info"
          showIcon
          title="这份草稿已经结束，不能再补全或提交"
        />
      )}

      {stage === 'loading' && (
        <Typography.Text type="secondary">正在读取草稿…</Typography.Text>
      )}

      {stage === 'editing' && !closed && (
        <Flex vertical gap={12} style={{ minWidth: 0 }}>
          <Typography.Text strong>还需要你补全以下信息</Typography.Text>
          {serverErrors.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={serverErrors
                .map((item) => `${item.label}：${item.message}`)
                .join('；')}
            />
          )}
          <CompletionForm
            ref={formRef}
            fields={fields}
            values={values}
            onChange={(next) => {
              collectedRef.current = { ...values, ...next };
            }}
            disabled={saving}
          />
          <Flex justify="flex-end" gap={8} wrap>
            <Button type="primary" loading={saving} onClick={() => void complete()}>
              完成补充
            </Button>
          </Flex>
        </Flex>
      )}

      {stage === 'confirming' && !closed && (
        <Flex vertical gap={12} style={{ minWidth: 0 }}>
          <Typography.Text strong>
            {subject ? `${subject}信息已准备好` : '信息已准备好'}
          </Typography.Text>
          <Typography.Text type="secondary">
            {subject ? `请确认是否创建该${subject}` : '请确认是否提交'}
          </Typography.Text>
          <Flex justify="flex-end" gap={8} wrap>
            <Button onClick={() => setStage('editing')}>返回修改</Button>
            <Button type="primary" onClick={() => void confirm()}>
              确认创建
            </Button>
          </Flex>
        </Flex>
      )}

      {stage === 'submitting' && (
        <Typography.Text type="secondary">正在创建…</Typography.Text>
      )}

      {stage === 'done' && (
        <Alert type="success" showIcon title={notice || '创建成功'} />
      )}
    </Flex>
  );
}
