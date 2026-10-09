/**
 * 新建任务 Modal（浮在客户详情 Drawer 之上）。
 *
 * 设计原则：
 *   - 不暴露「所属客户」「状态」「编号」 —— 由上下文 / 系统自动 / 不在 MVP 暴露
 *   - 字段严格按 spec：任务标题 / 截止时间 / 负责人 / 优先级 / 备注
 *   - 沿用 ContactCreateModal 的 controlled-open + formRef + useState submitting + try/finally 模式
 *   - 截止时间 ProFormDateTimePicker（精确到时分，spec 要求）
 *   - 负责人默认 = currentUser；优先级默认 = 'normal'
 *   - status 默认 'todo'，UI 不暴露，服务端硬编码
 *   - 仅 create 模式（编辑流后续单独做）
 *   - 失败保留用户已输入数据，Modal 不关
 *
 * 任务 ≠ 跟进（FollowUp）：本 Modal 只承担「未来待办」登记，不混销售事实记录。
 */

import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Row } from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createTask,
  TASK_PRIORITY_OPTIONS,
  type TaskInput,
  type TaskRow,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';

export interface TaskCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  /** 候选人列表（来自 sys_users）。 */
  assigneeOptions: Array<{ value: number; label: string }>;
  /** 默认选中（通常 currentUser.id）。 */
  defaultAssigneeId?: number;
  onSuccess?: (task: TaskRow) => void;
}

interface FormValues {
  title?: string;
  dueAt?: Dayjs;
  assigneeId?: number;
  priority?: string;
  remark?: string;
}

const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  open,
  onOpenChange,
  customerId,
  assigneeOptions,
  defaultAssigneeId,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance<FormValues>>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const initialValues = useMemo<FormValues>(
    () => ({
      title: undefined,
      dueAt: undefined,
      assigneeId: defaultAssigneeId,
      priority: 'normal',
      remark: undefined,
    }),
    [defaultAssigneeId],
  );

  useEffect(() => {
    if (open) return;
    formRef.current?.resetFields();
  }, [open]);

  return (
    <ModalForm<FormValues>
      key="task-create"
      open={open}
      onOpenChange={onOpenChange}
      title="新建任务"
      width={560}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
        width: 560,
        style: { maxWidth: 'calc(100vw - 48px)' },
      }}
      submitter={{
        searchConfig: { submitText: '创建', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (raw) => {
        const title = (raw.title ?? '').trim();
        if (!title) {
          message.error('请输入任务标题');
          return false;
        }
        if (title.length > 100) {
          message.error('任务标题最多 100 个字符');
          return false;
        }

        const input: TaskInput = {
          customerId,
          title,
          status: 'todo', // 服务端默认 'todo'，UI 不暴露
          priority: raw.priority ?? 'normal',
          assigneeUserId: raw.assigneeId ?? defaultAssigneeId ?? null,
          dueAt: raw.dueAt ? raw.dueAt.toISOString() : null,
          description: raw.remark?.trim() || null,
        };

        setSubmitting(true);
        try {
          const saved = await createTask(input);
          message.success('任务创建成功');
          onSuccess?.(saved);
          onOpenChange(false);
          return true;
        } catch (err) {
          message.error(err instanceof Error ? err.message : '任务创建失败');
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <ProFormText
        name="title"
        label="任务标题"
        placeholder="请输入任务内容"
        rules={[
          { required: true, whitespace: true, message: '请输入任务标题' },
          { max: 100, message: '任务标题最多 100 个字符' },
        ]}
      />

      <ProFormDateTimePicker
        name="dueAt"
        label="截止时间"
        placeholder="请选择截止时间（可选）"
        fieldProps={{
          style: { width: '100%' },
          format: 'YYYY-MM-DD HH:mm:ss',
        }}
      />

      <Row gutter={24}>
        <Col span={12}>
          <ProFormSelect
            name="assigneeId"
            label="负责人"
            placeholder={
              assigneeOptions.length ? '请选择负责人' : '暂无可选负责人'
            }
            options={assigneeOptions}
            disabled={assigneeOptions.length === 0}
            allowClear
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="priority"
            label="优先级"
            placeholder="请选择优先级"
            options={TASK_PRIORITY_OPTIONS.map((p) => ({
              value: p.value,
              label: p.label,
            }))}
          />
        </Col>
      </Row>

      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="补充任务说明等（可选）"
        fieldProps={{
          autoSize: { minRows: 2, maxRows: 4 },
          maxLength: 500,
          showCount: true,
        }}
      />
    </ModalForm>
  );
};

export default TaskCreateModal;
