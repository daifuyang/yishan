import { history } from '@umijs/max';
import { AI_PREFILL_ROUTES, setAiPrefill } from '@yishan/core-system-admin/ai-prefill';
import { Alert, Button } from 'antd';
import React, { useContext, useRef, useState } from 'react';
import { AiFormAssistanceContext } from '../../context/formAssistance';
import type { DraftOutcome } from '../../context/formAssistance';
import { ToolCallCard } from '../components/ToolCallCard';
import { NAVIGATE_TARGETS } from '../labels';
import type { ToolRendererProps } from '../model';
import { record, text } from '../safe-data';

/** 原生确认窗目前只支持删除用户；新增动作要在**原生表单**里实现，不在卡片里实现。 */
const CONFIRM_ACTIONS: Record<string, { target: 'user.delete'; route: string }> = {
  'user.delete': { target: 'user.delete', route: AI_PREFILL_ROUTES['user.delete'] },
};

export function ActionResultRenderer({ tool }: ToolRendererProps) {
  const assist = useContext(AiFormAssistanceContext);
  const [openedRequest, setOpenedRequest] = useState<
    { key: string; outcome?: DraftOutcome } | undefined
  >(undefined);
  const opening = useRef<{ key: string; outcome?: DraftOutcome } | undefined>(
    undefined,
  );
  const [error, setError] = useState('');
  if (tool.presentation.type !== 'action-result') return <ToolCallCard tool={tool} />;
  const data = record(tool.presentation.data);
  const mode = text(data.mode);
  const target = text(data.target);
  if (mode === 'navigate') {
    const destination = Object.hasOwn(NAVIGATE_TARGETS, target)
      ? NAVIGATE_TARGETS[target]
      : undefined;
    return (
      <ToolCallCard
        tool={tool}
        actions={
          destination ? (
            <Button
              size="small"
              type="link"
              onClick={() => history.push(destination.route)}
            >
              前往{destination.label} →
            </Button>
          ) : undefined
        }
      />
    );
  }
  const action = Object.hasOwn(CONFIRM_ACTIONS, target)
    ? CONFIRM_ACTIONS[target]
    : undefined;
  const id = data.id;
  const validId = typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
  if (mode !== 'confirm' || !action || !validId) {
    return (
      <ToolCallCard tool={tool} defaultExpanded mode="detailed">
        <Alert type="error" title="删除目标无效，请重新查询" />
      </ToolCallCard>
    );
  }
  const outcome = assist?.outcomes[tool.id];
  const completed = outcome?.status === 'completed';
  const actionKey = `${assist?.identityEpoch ?? 0}:${tool.id}:${target}:${id}`;
  const opened = openedRequest?.key === actionKey && openedRequest.outcome === outcome;
  const openConfirmation = () => {
    if (completed || (opening.current?.key === actionKey && opening.current.outcome === outcome))
      return;
    opening.current = { key: actionKey, outcome };
    setOpenedRequest(opening.current);
    setError('');
    const request = {
      target: action.target,
      fields: { id },
      missing: [],
      requestId: tool.id,
    };
    try {
      if (assist?.requestPrefill) assist.requestPrefill(request);
      else {
        setAiPrefill(request);
        history.push(action.route);
      }
    } catch (cause) {
      opening.current = undefined;
      setOpenedRequest(undefined);
      setError(cause instanceof Error ? text(cause.message) : '打开确认失败，请重试');
    }
  };
  return (
    <ToolCallCard
      tool={{ ...tool, resultSummary: outcome?.message || '待人工确认' }}
      defaultExpanded
      mode="detailed"
      actions={
        !completed ? (
          <Button danger size="small" disabled={opened} onClick={openConfirmation}>
            打开删除确认
          </Button>
        ) : undefined
      }
    >
      <Alert
        type={
          completed ? 'success' : outcome?.status === 'failed' || error ? 'error' : 'warning'
        }
        title={error || outcome?.message || '删除操作等待确认'}
        description={
          completed
            ? undefined
            : `目标：${text(data.label) || '用户'}（ID：${id}）。请在原生确认窗口中确认，打开窗口不会自动删除。`
        }
      />
    </ToolCallCard>
  );
}
