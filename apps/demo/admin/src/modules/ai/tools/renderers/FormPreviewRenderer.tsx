import { history } from '@umijs/max';
import { peekNativeFormOperation } from '@yishan/core-admin/form-assistance';
import {
  AI_PREFILL_ROUTES,
  setAiPrefill,
  type AiPrefillTarget,
} from '@yishan/core-system-admin/ai-prefill';
import { Alert, Button, Flex, Typography } from 'antd';
import React, { useContext, useRef, useState } from 'react';
import { AiFormAssistanceContext } from '../../context/formAssistance';
import { ToolCallCard } from '../components/ToolCallCard';
import { ToolResultLine } from '../components/ToolResultLine';
import type { FormPreviewData, ToolRendererProps } from '../model';
import { formatValue, record, safeValue } from '../safe-data';

const SENSITIVE_FIELD = /password|passwd|pwd|token|secret|credential|authorization|cookie|apikey|privatekey/i;

interface PreviewField {
  name: string;
  label: string;
  required?: boolean;
  sensitive: boolean;
  value?: unknown;
  filled: boolean;
  missing: boolean;
}

/**
 * 把「表单契约 + 已填值 + 缺失清单」合并成一份字段视图。
 *
 * 三个来源都可能缺字段：契约（fieldDefinitions）是结构，已填值是内容，
 * 缺失清单是服务端算出来的缺口。合并时以服务端给的值为准。
 */
function previewFields(
  data: FormPreviewData,
  nativeLabels: Record<string, string>,
): PreviewField[] {
  const definitions = new Map(
    data.fieldDefinitions.map((field) => [field.name, field]),
  );
  const missing = new Map(data.missingFields.map((field) => [field.name, field]));
  const values = record(data.fields);
  const names = new Set<string>([
    ...definitions.keys(),
    ...missing.keys(),
    ...Object.keys(values),
  ]);
  return [...names].map((name) => {
    const definition = definitions.get(name);
    const gap = missing.get(name);
    const value = values[name];
    const sensitive =
      Boolean(definition?.sensitive || gap?.sensitive) ||
      SENSITIVE_FIELD.test(name);
    return {
      name,
      label: definition?.label ?? gap?.label ?? nativeLabels[name] ?? name,
      required: definition?.required ?? gap?.required,
      sensitive,
      value,
      filled: value !== undefined && value !== null && value !== '',
      missing: missing.has(name),
    };
  });
}

/** 标签后缀：只有**确定**必填/选填时才标，未知就保持原样。 */
function fieldLabel(field: PreviewField): string {
  if (field.required === true) return `${field.label}（必填）`;
  if (field.required === false) return `${field.label}（选填）`;
  return field.label;
}

/**
 * `form.prefill` 的渲染器：**把信息预填进原生表单**。
 *
 * 这条路径与草稿补全是两件事：
 *
 * - 预填：信息已经齐了，填进**用户自己的**表单页，由用户核对并点「确定」；
 * - 草稿补全：信息还不够，聊天里的补全面板收齐后再走一次原有创建接口。
 *
 * 因此这里只做一件事——把预填请求交给原生表单并跳转到对应页面。
 */
export function FormPreviewRenderer({ tool }: ToolRendererProps) {
  if (tool.presentation.type !== 'form-preview') return null;
  const data = tool.presentation.data;
  if (data.mode === 'draft') return <DraftRecord tool={tool} />;
  return <PrefillCard tool={tool} data={data} />;
}

/**
 * 草稿记录：**只**说明「信息已经写进草稿了」。
 *
 * 补全入口不在这里 —— 补全面板是独立组件，它和工具记录共享同一份草稿，
 * 但不把表单塞进工具卡片。
 */
function DraftRecord({ tool }: { tool: ToolRendererProps['tool'] }) {
  const running = tool.status === 'running' || tool.status === 'pending';
  const failed = tool.status === 'error' || tool.status === 'cancelled';
  /**
   * 展开状态由本组件掌握：**执行完成后默认收起**，用户手动展开后不再被
   * 后续的流式更新覆盖。
   */
  const [userExpanded, setUserExpanded] = useState<boolean | undefined>(undefined);
  const expanded = userExpanded ?? running;
  return (
    <ToolCallCard
      tool={tool}
      showDetails={false}
      showChevron
      expanded={expanded}
      onToggle={setUserExpanded}
    >
      {!failed && (
        <ToolResultLine
          muted={running}
          text={
            running ? '正在将提供的信息填入表单草稿' : '已将提供的信息填入表单草稿'
          }
        />
      )}
    </ToolCallCard>
  );
}

function PrefillCard({
  tool,
  data,
}: {
  tool: ToolRendererProps['tool'];
  data: FormPreviewData;
}) {
  const assist = useContext(AiFormAssistanceContext);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const route = Object.hasOwn(AI_PREFILL_ROUTES, data.operationId)
    ? AI_PREFILL_ROUTES[data.operationId as AiPrefillTarget]
    : undefined;
  const labels = peekNativeFormOperation(data.operationId)?.fieldLabels ?? {};
  const fields = previewFields(data, labels);
  const filled = fields.filter((field) => field.filled && !field.sensitive);
  const missing = fields.filter((field) => !field.filled || field.missing);

  const apply = async () => {
    if (!route || pending.current) return;
    pending.current = true;
    setApplying(true);
    setError('');
    try {
      const values = record(safeValue(data.fields));
      for (const field of data.fieldDefinitions) {
        if (field.sensitive) delete values[field.name];
      }
      const request = {
        target: data.operationId as AiPrefillTarget,
        fields: values,
        missing: data.missingFields.map((field) => field.name),
        requestId: tool.id,
      };
      if (assist?.requestPrefill) assist.requestPrefill(request);
      else {
        setAiPrefill(request);
        history.push(route);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '预填失败，请重试');
    } finally {
      pending.current = false;
      setApplying(false);
    }
  };

  return (
    <ToolCallCard
      tool={tool}
      mode="detailed"
      actions={
        route ? (
          <Button
            type="primary"
            size="small"
            loading={applying}
            onClick={() => {
              void apply();
            }}
          >
            打开表单核对并提交
          </Button>
        ) : undefined
      }
    >
      <Flex vertical gap={8}>
        {filled.map((field) => (
          <div
            key={field.name}
            style={{ display: 'flex', gap: 12, paddingBlock: 4, minWidth: 0 }}
          >
            <Typography.Text
              type="secondary"
              style={{ flex: '0 0 120px', overflowWrap: 'anywhere' }}
            >
              {fieldLabel(field)}
            </Typography.Text>
            <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {formatValue(field.value)}
            </div>
          </div>
        ))}
        {missing.map((field) =>
          field.required === true ? (
            <Typography.Text key={field.name} type="secondary">
              {fieldLabel(field)}：待补充
            </Typography.Text>
          ) : (
            <Flex key={field.name} gap={8} align="baseline">
              <Typography.Text type="secondary">
                {fieldLabel(field)}
              </Typography.Text>
              {field.required === false && (
                <Typography.Text type="secondary">未填写</Typography.Text>
              )}
            </Flex>
          ),
        )}
        {error && <Alert type="error" title={error} />}
      </Flex>
    </ToolCallCard>
  );
}
