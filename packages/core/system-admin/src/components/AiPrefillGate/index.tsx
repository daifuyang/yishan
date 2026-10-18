import { Alert } from 'antd';
import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  consumeAiPrefill,
  peekAiPrefill,
  publishAiPrefillResult,
  subscribeAiPrefill,
  type AiPrefill,
  type AiPrefillTarget,
} from '../../ai-prefill';

/**
 * AiPrefillGate — 把 AI 预填接到既有表单上。
 *
 * 它不新建表单，只做一件事：读到匹配的预填就把**已有的** UserForm /
 * DepartmentForm 以受控方式打开，并把字段灌进它们的 `initialValues`。
 * 保存仍然走表单原有的 onFinish —— AI 不参与写入。
 *
 * 挂载时消费一次即清空，所以刷新、返回、误开第二个弹窗都不会重复带出旧字段。
 */
export interface AiPrefillGateProps {
  target: AiPrefillTarget;
  /** 把预填字段翻译成本表单认识的字段名（表单与模型口径不一定一致）。 */
  mapFields?: (fields: Record<string, unknown>) => Record<string, unknown>;
  /** 已有的表单组件。传入后本组件只负责开关与字段，不关心表单内部。 */
  children: (state: {
    open: boolean;
    initialValues: Record<string, unknown>;
    missing: readonly string[];
    requestId?: string;
    close: () => void;
  }) => React.ReactNode;
}

export const AiPrefillGate: React.FC<AiPrefillGateProps> = ({
  target,
  mapFields,
  children,
}) => {
  const [prefill, setPrefill] = useState<AiPrefill | null>(null);
  const [open, setOpen] = useState(false);
  const active = useRef(false);

  // 订阅只在「本页确实存在待处理预填」时才需要；用快照避免额外渲染。
  useSyncExternalStore(subscribeAiPrefill, peekAiPrefill, peekAiPrefill);

  useEffect(() => {
    const consume = () => {
      const next = consumeAiPrefill(target);
      if (!next) return;
      if (active.current) {
        if (next.requestId)
          publishAiPrefillResult({
            requestId: next.requestId,
            status: 'failed',
            message: '请先保存或关闭当前表单，再打开另一条记录。',
          });
        return;
      }
      active.current = true;
      setPrefill(next);
      setOpen(true);
    };
    consume();
    // 预填可能在页面已挂载之后才写入（用户在浮窗里点了「打开表单」），
    // 所以订阅变更，而不是只在挂载时读一次。
    return subscribeAiPrefill(consume);
  }, [target]);

  if (!prefill) return null;
  const fields = mapFields
    ? mapFields({ ...prefill.fields })
    : { ...prefill.fields };
  return (
    <>
      {prefill.missing.length > 0 && (
        <Alert
          type="info"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          message="AI 已预填部分字段"
          description={`还需要你补充：${prefill.missing.join('、')}。这些字段不会由 AI 代填。`}
        />
      )}
      {children({
        open,
        initialValues: fields,
        missing: prefill.missing,
        requestId: prefill.requestId,
        close: () => {
          active.current = false;
          setOpen(false);
          setPrefill(null);
        },
      })}
    </>
  );
};
