/**
 * 新建商机 ModalForm。客户详情与全局商机列表共用，避免两套创建实现。
 */

import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Modal, Row, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  OPEN_OPPORTUNITY_STAGES,
  type OpportunityStageCode,
} from '@/modules/crm/domain/statuses';
import {
  type ContactRow,
  createOpportunity,
  checkOpportunityDuplicates,
  type CustomerRow,
  listContactsByCustomer,
  listCustomers,
  listSources,
  type OpportunityCreateInput,
  type OpportunityRow,
  type SourceRow,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';

const { Text } = Typography;

export interface OpportunityCreateModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactElement<{ onClick?: () => void }>;
  customerId?: number;
  customerName?: string;
  ownerId?: number | null;
  ownerName?: string | null;
  sourceId?: number | null;
  existingContacts?: ContactRow[];
  onSuccess?: (opportunity: OpportunityRow) => void;
}

interface FormValues {
  name?: string;
  customerDisplay?: string;
  customerId?: number;
  primaryContactId?: number;
  stage?: Exclude<OpportunityStageCode, 'won' | 'lost'>;
  expectedAmount?: number;
  expectedCloseDate?: Dayjs;
  ownerDisplay?: string;
  sourceId?: number;
  requirement?: string;
  competition?: string;
  remark?: string;
}

const stageOptions = OPEN_OPPORTUNITY_STAGES.map((stage) => ({
  value: stage.value,
  label: stage.label,
}));

function SectionTitle({ text }: { text: string }) {
  return (
    <Text
      type="secondary"
      style={{ display: 'block', margin: '4px 0 8px', fontSize: 13 }}
    >
      {text}
    </Text>
  );
}

const OpportunityCreateModal: React.FC<OpportunityCreateModalProps> = ({
  open,
  onOpenChange,
  trigger,
  customerId,
  customerName,
  ownerId,
  ownerName,
  sourceId,
  existingContacts,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance<FormValues>>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>(existingContacts ?? []);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const lockedCustomer = customerId != null;

  useEffect(() => {
    let cancelled = false;
    listSources({ page: 1, pageSize: 100 })
      .then((result) => {
        if (!cancelled) setSources(result.data);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (existingContacts) {
      setContacts(existingContacts);
      return;
    }
    if (!customerId) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    listContactsByCustomer(customerId)
      .then((rows) => {
        if (!cancelled) setContacts(rows);
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, existingContacts]);

  const defaultPrimaryContactId = useMemo(() => {
    const primary = contacts.find((contact) => contact.isPrimary === 1);
    if (primary) return primary.id;
    if (contacts.length === 1) return contacts[0]?.id;
    return undefined;
  }, [contacts]);

  const initialValues = useMemo<FormValues>(
    () => ({
      customerId,
      primaryContactId: defaultPrimaryContactId,
      stage: 'needs_confirmation',
      ownerDisplay: ownerName?.trim() || '当前用户',
      sourceId: sourceId ?? undefined,
      customerDisplay: customerName,
    }),
    [customerId, customerName, defaultPrimaryContactId, ownerName, sourceId],
  );

  useEffect(() => {
    if (open === false) {
      formRef.current?.resetFields();
      return;
    }
    if (open) {
      formRef.current?.setFieldsValue(initialValues);
    }
  }, [open, initialValues]);

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
  const sourceOptions = useMemo(
    () =>
      sources
        .filter((item) => item.enabled === 1)
        .map((item) => ({ value: item.id, label: item.name })),
    [sources],
  );

  const submit = async (raw: FormValues) => {
    const name = (raw.name ?? '').trim();
    const requirement = (raw.requirement ?? '').trim();
    const resolvedCustomerId = customerId ?? raw.customerId;
    if (!name) {
      message.error('请输入商机名称');
      return false;
    }
    if (!resolvedCustomerId) {
      message.error('请选择所属客户');
      return false;
    }
    if (!requirement) {
      message.error('请填写需求摘要');
      return false;
    }
    if (ownerId == null) {
      message.error('无法识别负责人，请重新登录后再试');
      return false;
    }

    const input: OpportunityCreateInput = {
      name,
      customerId: resolvedCustomerId,
      ownerId,
      primaryContactId: raw.primaryContactId ?? null,
      stage: raw.stage ?? 'needs_confirmation',
      requirement,
      amountCents:
        raw.expectedAmount == null ? null : Math.round(raw.expectedAmount * 100),
      expectedCloseDate: raw.expectedCloseDate
        ? dayjs(raw.expectedCloseDate).startOf('day').toISOString()
        : null,
      sourceId: raw.sourceId ?? null,
      competition: raw.competition?.trim() || null,
      remark: raw.remark?.trim() || undefined,
      creationKey:
        typeof globalThis.crypto?.randomUUID === 'function'
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };

    setSubmitting(true);
    try {
      const duplicates = await checkOpportunityDuplicates(
        resolvedCustomerId,
        name,
      );
      if (duplicates.length > 0) {
        const detail = duplicates
          .map(
            (item) =>
              `${item.name}（${item.opportunityNo || `OPP-${item.id}`}）\n当前阶段：${
                stageOptions.find((stage) => stage.value === item.stage)?.label ??
                item.stage
              }\n负责人：${item.ownerName || '—'}`,
          )
          .join('\n\n');
        const proceed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '发现该客户已有同名进行中商机',
            content: (
              <Typography.Paragraph style={{ whiteSpace: 'pre-line' }}>
                {detail}
                {'\n\n'}仍然创建新的独立商机？
              </Typography.Paragraph>
            ),
            okText: '仍然创建',
            cancelText: '查看已有商机',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!proceed) return false;
      }
      const saved = await createOpportunity(input);
      message.success('商机创建成功');
      onSuccess?.(saved);
      onOpenChange?.(false);
      return true;
    } catch (err) {
      message.error(err instanceof Error ? err.message : '商机创建失败');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalForm<FormValues>
      title="新建商机"
      width={720}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      open={trigger ? undefined : open}
      trigger={trigger}
      onOpenChange={onOpenChange}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
      }}
      submitter={{
        searchConfig: { submitText: '创建', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={submit}
    >
      <SectionTitle text="基本信息" />
      <ProFormText
        name="name"
        label="商机名称"
        placeholder="例如：禾味餐饮 CRM 数字化项目"
        rules={[
          { required: true, whitespace: true, message: '请输入商机名称' },
          { max: 100, message: '商机名称最多 100 个字符' },
        ]}
      />
      <Row gutter={16}>
        <Col span={12}>
          {lockedCustomer ? (
            <ProFormText name="customerDisplay" label="所属客户" disabled />
          ) : (
            <ProFormSelect
              name="customerId"
              label="所属客户"
              showSearch
              rules={[{ required: true, message: '请选择所属客户' }]}
              request={async ({ keyWords }) =>
                (
                  await listCustomers({
                    page: 1,
                    pageSize: 50,
                    keyword: keyWords,
                  })
                ).data.map((item: CustomerRow) => ({
                  value: item.id,
                  label: item.name,
                }))
              }
              fieldProps={{
                onChange: (value: number) => {
                  formRef.current?.setFieldValue('primaryContactId', undefined);
                  setContacts([]);
                  if (!value) return;
                  void listContactsByCustomer(value)
                    .then((rows) => {
                      setContacts(rows);
                      if (rows.length === 1) {
                        formRef.current?.setFieldValue(
                          'primaryContactId',
                          rows[0].id,
                        );
                      }
                    })
                    .catch(() => setContacts([]));
                  void listCustomers({ page: 1, pageSize: 50 }).then((result) => {
                    const selected = result.data.find((item) => item.id === value);
                    if (selected?.sourceId) {
                      formRef.current?.setFieldValue('sourceId', selected.sourceId);
                    }
                  });
                },
              }}
            />
          )}
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="primaryContactId"
            label="主要联系人"
            placeholder={contacts.length ? '请选择联系人' : '暂无联系人'}
            options={contactOptions}
            allowClear
          />
        </Col>
      </Row>

      <SectionTitle text="销售计划" />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormSelect
            name="stage"
            label="商机阶段"
            options={stageOptions}
            rules={[{ required: true, message: '请选择商机阶段' }]}
          />
        </Col>
        <Col span={12}>
          <ProFormDigit
            name="expectedAmount"
            label="预计金额"
            placeholder="请输入预计金额"
            fieldProps={{ min: 0, precision: 2, prefix: '¥' }}
          />
        </Col>
        <Col span={12}>
          <ProFormDatePicker
            name="expectedCloseDate"
            label="预计成交日期"
            placeholder="请选择日期"
            fieldProps={{ format: 'YYYY-MM-DD', style: { width: '100%' } }}
          />
        </Col>
        <Col span={12}>
          <ProFormText name="ownerDisplay" label="负责人" disabled />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="sourceId"
            label="商机来源"
            options={sourceOptions}
            placeholder="请选择来源"
            allowClear
          />
        </Col>
      </Row>

      <SectionTitle text="需求信息" />
      <ProFormTextArea
        name="requirement"
        label="需求摘要"
        placeholder="请输入客户需求、账号规模及核心能力要求"
        fieldProps={{ rows: 4, maxLength: 1000, showCount: true }}
        rules={[
          { required: true, whitespace: true, message: '请填写需求摘要' },
        ]}
      />
      <ProFormTextArea
        name="competition"
        label="竞争情况"
        placeholder="例如：目前正在同时对比另外两家产品"
        fieldProps={{ rows: 3, maxLength: 1000 }}
      />
      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="补充下一步计划或其他信息"
        fieldProps={{ rows: 3, maxLength: 1000 }}
      />
    </ModalForm>
  );
};

export default OpportunityCreateModal;
