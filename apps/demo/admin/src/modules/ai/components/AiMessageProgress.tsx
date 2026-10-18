import { Think, ThoughtChain, type ThoughtChainItemType } from '@ant-design/x';
import XMarkdown from '@ant-design/x-markdown';
import type { UIMessage } from 'ai';
import { Flex } from 'antd';
import React from 'react';

const toolLabels: Record<string, string> = {
  list_users: '查询用户',
  get_user: '读取用户详情',
  list_roles: '查询角色',
  get_role: '读取角色详情',
  list_departments: '查询部门',
  get_department: '读取部门详情',
  get_user_create_form: '读取用户表单',
  get_user_create_options: '读取表单选项',
  prepare_user_create: '准备新增用户表单',
  prepare_update_user: '准备编辑用户表单',
  prepare_delete_user: '准备删除用户确认',
  prepare_create_department: '准备新增部门表单',
  prepare_create_user: '更新用户草稿',
  get_action_draft: '读取草稿',
  update_action_draft: '更新草稿',
};

export function AiMessageProgress({
  message,
  streaming,
}: {
  message: UIMessage;
  streaming: boolean;
}) {
  const reasoning = message.parts.filter((part) => part.type === 'reasoning');
  const reasoningText = reasoning.map((part) => part.text).join('\n\n');
  const thinking =
    streaming && reasoning.some((part) => part.state === 'streaming');
  const items: ThoughtChainItemType[] = [];
  for (const part of message.parts) {
    if (
      !part.type.startsWith('tool-') ||
      !('toolCallId' in part) ||
      !('state' in part)
    )
      continue;
    const failed =
      part.state === 'output-error' ||
      part.state === 'output-denied' ||
      (part.state === 'output-available' &&
        'output' in part &&
        typeof part.output === 'object' &&
        part.output !== null &&
        'ok' in part.output &&
        part.output.ok === false);
    const complete = part.state === 'output-available';
    const pending = !failed && !complete;
    items.push({
      key: part.toolCallId,
      title: toolLabels[part.type.slice(5)] || part.type.slice(5),
      status: failed
        ? 'error'
        : complete
          ? 'success'
          : streaming
            ? 'loading'
            : 'abort',
      description: failed
        ? '执行失败'
        : complete
          ? '执行完成'
          : !streaming
            ? '已中止'
            : part.state === 'input-streaming'
              ? '正在准备参数'
              : '正在执行',
      blink: pending && streaming,
    });
  }
  if (!reasoningText && !items.length) return null;
  return (
    <Flex vertical gap={8} style={{ width: '100%' }}>
      {reasoningText && (
        <Think
          title={thinking ? '思考中' : '思考过程'}
          loading={thinking}
          defaultExpanded
        >
          <XMarkdown
            content={reasoningText}
            escapeRawHtml
            streaming={{ hasNextChunk: thinking, tail: thinking }}
          />
        </Think>
      )}
      {items.length > 0 && <ThoughtChain items={items} />}
    </Flex>
  );
}
