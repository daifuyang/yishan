import { Alert, Button, Flex, Typography } from 'antd';
import { AiQuestionField } from './AiQuestionField';
import React, { useEffect, useRef, useState } from 'react';
import {
  answerDraftQuestion,
  listDraftQuestions,
  type DraftQuestion,
} from '../services/draftQuestionService';
import type { ActionDraft } from '../services/actionDraftService';
import { chatError } from '../services/chatError';

export function AiQuestionCard({
  draftId,
  conversationId,
  draftVersion,
  onAnswered,
  beforeRequest,
  operationId,
}: {
  draftId: string;
  conversationId: string;
  draftVersion: number;
  onAnswered?: (draft: ActionDraft) => void;
  beforeRequest?: () => Promise<void>;
  operationId?: string;
}) {
  const [question, setQuestion] = useState<DraftQuestion | null>(null);
  const [values, setValues] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const lifecycle = useRef(0);
  const pending = useRef(false);

  const load = async () => {
    const current = ++generation.current;
    setLoading(true);
    setError('');
    try {
      await beforeRequest?.();
      const result = await listDraftQuestions(draftId, conversationId);
      if (current !== generation.current) return;
      setQuestion(result.questions[0] ?? null);
      setValues([]);
    } catch (cause) {
      if (current === generation.current) setError(chatError(cause));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    setQuestion(null);
    setAnswered(false);
    pending.current = false;
    setSubmitting(false);
    void load();
    return () => {
      generation.current += 1;
      lifecycle.current += 1;
    };
  }, [draftId, conversationId, draftVersion]);

  const submit = async () => {
    if (!question || pending.current) return;
    pending.current = true;
    setSubmitting(true);
    setError('');
    const current = generation.current;
    const owner = lifecycle.current;
    try {
      await beforeRequest?.();
      if (current !== generation.current) return;
      // Native edits may have advanced the draft while this question was visible.
      const fresh = await listDraftQuestions(draftId, conversationId);
      if (current !== generation.current) return;
      const latest = fresh.questions.find(
        (item) => item.field === question.field,
      );
      if (!latest) {
        setQuestion(fresh.questions[0] ?? null);
        setValues([]);
        setError('该字段已在原生表单中更新，请核对当前信息。');
        return;
      }
      setQuestion(latest);
      if (
        values.some(
          (value) => !latest.options.some((option) => option.value === value),
        )
      ) {
        setError('可选项已更新，请重新选择。');
        return;
      }
      const draft = await answerDraftQuestion(draftId, {
        conversationId,
        questionId: latest.questionId,
        draftVersion: latest.draftVersion,
        values,
      });
      if (current !== generation.current) return;
      setAnswered(true);
      onAnswered?.(draft);
      await load();
    } catch (cause) {
      if (current === generation.current) setError(chatError(cause));
    } finally {
      if (owner === lifecycle.current) {
        pending.current = false;
        setSubmitting(false);
      }
    }
  };

  if (loading)
    return (
      <Typography.Text type="secondary">正在读取待确认信息…</Typography.Text>
    );
  if (!question && !error && !answered) return null;
  return (
    <Flex vertical gap={8} style={{ marginBottom: 8 }}>
      {question && (
        <>
          <Typography.Text strong>{question.title}</Typography.Text>
          <AiQuestionField
            operationId={operationId}
            field={question.field}
            multiple={question.multiple}
            value={values}
            disabled={submitting}
            onChange={setValues}
            options={question.options}
          />
          {question.allowEmpty && (
            <Typography.Text type="secondary">
              可以不选，点击确认表示本次不分配。
            </Typography.Text>
          )}
          {question.truncated && (
            <Alert
              type="info"
              title="候选未全部展示，可在原生表单中查询完整选项。"
            />
          )}
          <Button
            type="primary"
            loading={submitting}
            disabled={!question.allowEmpty && !values.length}
            onClick={() => void submit()}
          >
            确认选择
          </Button>
        </>
      )}
      {answered && !question && (
        <Alert
          type="success"
          title="选择已保存到草稿，请在原生表单核对后提交。"
        />
      )}
      {error && (
        <>
          <Alert type="error" title={error} />
          <Button disabled={submitting} onClick={() => void load()}>
            重新读取问题
          </Button>
        </>
      )}
    </Flex>
  );
}
