/**
 * 新增跟进 ModalForm。挂在客户详情 Drawer 上，成功后由父级刷新详情与动态。
 *
 * 跟进结果只记录本次沟通，不改客户状态、不创建商机。
 */

import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Row } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FOLLOW_UP_RESULTS,
  FOLLOW_UP_TYPES,
  type FollowUpResult,
  type FollowUpType,
} from '@/modules/crm/domain/statuses';
import {
  type ActivityRow,
  createActivity,
  type ContactRow,
  listContactsByCustomer,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from './_shared/crmDialogZIndex';

export interface CustomerFollowUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  onSuccess?: (activity: ActivityRow) => void;
}

interface FormValues {
  followUpType?: FollowUpType;
  contactId?: number;
  followedAt?: Dayjs;
  content?: string;
  result?: FollowUpResult;
  nextFollowUpAt?: Dayjs | null;
  nextFollowUpPlan?: string;
}

const typeOptions = FOLLOW_UP_TYPES.map((item) => ({
  value: item.value,
  label: item.label,
}));
const resultOptions = FOLLOW_UP_RESULTS.map((item) => ({
  value: item.value,
  label: item.label,
}));

const CustomerFollowUpModal: React.FC<CustomerFollowUpModalProps> = ({
  open,
  onOpenChange,
  customerId,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance<FormValues>>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listContactsByCustomer(customerId)
      .then((rows) => {
        if (cancelled) return;
        setContacts(rows);
        const current = formRef.current?.getFieldValue('contactId');
        if (current == null && rows.length === 1) {
          formRef.current?.setFieldValue('contactId', rows[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  const contactOptions = useMemo(
    () =>
      contacts.map((contact) => ({
        value: contact.id,
        label: contact.position
          ? `${contact.name} · ${contact.position}`
          : contact.name,
      })),
    [contacts],
  );

  return (
    <ModalForm<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title="新增跟进"
      width={660}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={{
        followedAt: dayjs(),
      }}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
      }}
      submitter={{
        searchConfig: { submitText: '保存', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (values) => {
        const content = values.content?.trim() ?? '';
        if (!values.followUpType) {
          message.error('请选择跟进方式');
          return false;
        }
        if (!content) {
          message.error('请输入跟进内容');
          return false;
        }
        const plan = values.nextFollowUpPlan?.trim() ?? '';
        if (plan && !values.nextFollowUpAt) {
          message.warning('建议设置下次跟进时间');
        }

        setSubmitting(true);
        try {
          const saved = await createActivity(customerId, {
            type: values.followUpType,
            content,
            contactId: values.contactId ?? null,
            occurredAt: dayjs(values.followedAt ?? undefined).toISOString(),
            nextFollowUpAt: values.nextFollowUpAt
              ? dayjs(values.nextFollowUpAt).toISOString()
              : null,
            result: values.result ?? null,
            nextFollowUpPlan: plan || null,
          });
          message.success('跟进已保存');
          onSuccess?.(saved);
          return true;
        } catch (err) {
          message.error(err instanceof Error ? err.message : '跟进保存失败');
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <ProFormSelect
            name="followUpType"
            label="跟进方式"
            options={typeOptions}
            placeholder="请选择"
            rules={[{ required: true, message: '请选择跟进方式' }]}
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="contactId"
            label="联系人"
            options={contactOptions}
            placeholder="请选择联系人"
            fieldProps={{ allowClear: true }}
          />
        </Col>
        <Col span={12}>
          <ProFormDateTimePicker
            name="followedAt"
            label="跟进时间"
            rules={[{ required: true, message: '请选择跟进时间' }]}
            fieldProps={{
              style: { width: '100%' },
              format: 'YYYY-MM-DD HH:mm',
              showTime: { format: 'HH:mm' },
            }}
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="result"
            label="跟进结果"
            options={resultOptions}
            placeholder="请选择"
            fieldProps={{ allowClear: true }}
          />
        </Col>
      </Row>
      <ProFormTextArea
        name="content"
        label="跟进内容"
        placeholder="请输入本次沟通内容、客户需求及重要信息"
        fieldProps={{ rows: 4, maxLength: 2000, showCount: true }}
        rules={[
          { required: true, whitespace: true, message: '请输入跟进内容' },
        ]}
      />
      <ProFormDateTimePicker
        name="nextFollowUpAt"
        label="下次跟进时间"
        placeholder="请选择下次跟进时间"
        fieldProps={{
          style: { width: '100%' },
          format: 'YYYY-MM-DD HH:mm',
          showTime: { format: 'HH:mm' },
        }}
      />
      <ProFormTextArea
        name="nextFollowUpPlan"
        label="下次跟进计划"
        placeholder="例如：发送产品资料并预约产品演示"
        fieldProps={{ rows: 2, maxLength: 500 }}
      />
    </ModalForm>
  );
};

export default CustomerFollowUpModal;
