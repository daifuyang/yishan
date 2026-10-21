import { peekNativeFormOperation } from '@yishan/core-admin/form-assistance';
import { Alert, Button, Flex, Typography } from 'antd';
import React, { useContext, useEffect, useState } from 'react';
import { AiFormAssistanceContext } from '../context/formAssistance';
import {
  getActionDraft,
  type ActionDraft,
} from '../services/actionDraftService';
import { chatError } from '../services/chatError';

/** 草稿只提供原生表单入口和真实回执，不持有第二份编辑值或提交能力。 */
export function AiFormCompletion({
  draftId,
  operationId,
}: {
  draftId: string;
  operationId: string;
}) {
  const assistance = useContext(AiFormAssistanceContext);
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setDraft(null);
    setError('');
    void getActionDraft(draftId)
      .then((next) => {
        if (!cancelled) setDraft(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(chatError(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [draftId, retry, assistance?.identityEpoch]);

  const outcome = assistance?.outcomes[draftId];
  const completed =
    outcome?.status === 'completed' || draft?.status === 'completed';
  const ended = draft && ['cancelled', 'expired'].includes(draft.status);
  const submitting = draft?.status === 'submitting';
  const subject = peekNativeFormOperation(operationId)?.name ?? '业务';
  // 缺失项仅用于提示；即使补全元数据为空，也不代表允许提交。
  const required = new Map<string, string>();
  for (const field of draft?.missingFields ?? []) {
    if (field.required) required.set(field.name, field.label);
  }
  for (const field of draft?.completionFields ?? []) {
    if (field.required || field.invalid) required.set(field.name, field.label);
  }
  for (const field of draft?.validationErrors ?? [])
    required.set(field.field, field.label);

  return (
    <Flex vertical gap={12} style={{ width: '100%', minWidth: 0 }}>
      {completed ? (
        <Alert
          type="success"
          showIcon
          title={
            outcome?.status === 'completed'
              ? outcome.message
              : `${subject}已创建`
          }
        />
      ) : ended ? (
        <Alert type="info" showIcon title="这份草稿已结束，请重新准备表单" />
      ) : (
        <>
          {outcome && (
            <Alert
              type={outcome.status === 'failed' ? 'error' : 'info'}
              showIcon
              title={outcome.message}
            />
          )}
          {error ? (
            <>
              <Alert type="error" showIcon title={error} />
              <Button onClick={() => setRetry((value) => value + 1)}>
                重新读取
              </Button>
            </>
          ) : !draft ? (
            <Typography.Text type="secondary">正在读取草稿…</Typography.Text>
          ) : (
            <>
              <Typography.Text strong>{subject}表单草稿已保存</Typography.Text>
              <Typography.Text type="secondary">
                {submitting
                  ? '正在核对提交结果，请勿重复创建。'
                  : '请在业务表单中检查和补充信息，再点击表单的确定按钮提交。'}
              </Typography.Text>
              {!submitting && required.size > 0 && (
                <Typography.Text type="secondary">
                  请在表单中检查：{[...required.values()].join('、')}。
                </Typography.Text>
              )}
              {submitting && (
                <Button onClick={() => setRetry((value) => value + 1)}>
                  核对提交结果
                </Button>
              )}
              {assistance && !submitting && (
                <Flex justify="flex-end">
                  <Button
                    type="primary"
                    onClick={() => assistance.requestRestore(draftId)}
                  >
                    继续填写表单
                  </Button>
                </Flex>
              )}
            </>
          )}
        </>
      )}
    </Flex>
  );
}
