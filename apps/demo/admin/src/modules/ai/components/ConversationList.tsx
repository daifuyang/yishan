import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Conversations } from '@ant-design/x';
import { Form, Input, Modal } from 'antd';
import React, { useState } from 'react';
import { conversationGroup } from '../adapters/messages';
import { useAiChat } from '../hooks/useAiChat';
import type { AiConversation } from '../services/aiChatService';

/**
 * 会话列表：全屏工作台的固定侧栏与浮窗的历史抽屉共用同一实现，
 * 因此重命名 / 删除 / 新建的交互与状态在两种形态下完全一致。
 */
export function ConversationList({ onSelected }: { onSelected?: () => void }) {
  const chat = useAiChat();
  const [modal, contextHolder] = Modal.useModal();
  const [renaming, setRenaming] = useState<AiConversation | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ title: string }>();
  return (
    <>
      {contextHolder}
      <Conversations
        items={chat.conversations.map((item) => ({
          key: item.id,
          label: item.title,
          group: conversationGroup(item.updatedAt),
          disabled: chat.busy || chat.loading,
        }))}
        groupable
        activeKey={chat.activeId || undefined}
        creation={{
          label: '新建对话',
          icon: <PlusOutlined />,
          disabled: chat.busy || chat.loading,
          onClick: () => {
            chat.newConversation();
            onSelected?.();
          },
        }}
        onActiveChange={(id) => {
          void chat.selectConversation(id).then(onSelected);
        }}
        menu={(item) => ({
          items: [
            {
              key: 'rename',
              label: '重命名',
              icon: <EditOutlined />,
              disabled: chat.busy || chat.loading,
              onClick: () => {
                const conversation = chat.conversations.find(
                  (entry) => entry.id === item.key,
                );
                if (conversation) {
                  setRenaming(conversation);
                  form.setFieldsValue({ title: conversation.title });
                }
              },
            },
            {
              key: 'delete',
              label: '删除',
              danger: true,
              icon: <DeleteOutlined />,
              disabled: chat.busy || chat.loading,
              onClick: () => {
                modal.confirm({
                  title: '删除对话？',
                  content: '删除后无法恢复此对话的消息。',
                  okText: '删除',
                  cancelText: '取消',
                  okButtonProps: { danger: true },
                  onOk: () => chat.removeConversation(item.key),
                });
              },
            },
          ],
        })}
      />
      <Modal
        title="重命名对话"
        open={renaming !== null}
        onCancel={() => setRenaming(null)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async ({ title }) => {
            if (!renaming) return;
            setSaving(true);
            try {
              if (await chat.rename(renaming.id, title)) setRenaming(null);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item
            name="title"
            label="对话标题"
            rules={[
              { required: true, whitespace: true, message: '请输入对话标题' },
              { max: 100, message: '标题不能超过100个字符' },
            ]}
          >
            <Input maxLength={100} autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
