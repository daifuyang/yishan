/**
 * 商机创建 Modal（浮在客户详情 Drawer 之上）。
 *
 * 设计原则：
 *   - 不暴露「所属客户」「负责人」（由上下文确定）
 *   - 字段严格按 spec：商机名称 / 联系人 / 预计金额 / 销售阶段 / 预计成交日期 / 备注
 *   - 沿用 ContactCreateModal 的 controlled-open + formRef + useState submitting + try/finally 模式
 *   - 金额 / 日期走 transform：yuan → cents / Dayjs → ISO
 *   - 失败保留用户已输入的数据（Modal 不关）
 *
 * 当前阶段不开放编辑模式 —— 仅 create。
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
import { App, Col, Row } from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useMemo, useRef, useState } from 'react';
import { OPPORTUNITY_STAGES } from '@/modules/crm/domain/statuses';
import {
  type ContactRow,
  createOpportunity,
  type OpportunityCreateInput,
  type OpportunityRow,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';

export interface OpportunityCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前客户 ID（上下文确定）。 */
  customerId: number;
  /** 当前客户负责人；新建商机时 ownerId 默认沿用此值。 */
  ownerId: number | null;
  /** 已存在的联系人列表，用于智能默认 primaryContactId。 */
  existingContacts: ContactRow[];
  onSuccess?: (opportunity: OpportunityRow) => void;
}

interface FormValues {
  name?: string;
  primaryContactId?: number;
  expectedAmount?: number;
  stage?: 'requirement' | 'proposal' | 'negotiation';
  expectedCloseDate?: Dayjs;
  remark?: string;
}

/**
 * stage 选项 —— 复用领域常量，过滤掉终态（won / lost）。
 * 后端 service 也会校验，但前端先过滤避免给用户错误的选项。
 */
const stageOptions = OPPORTUNITY_STAGES.filter(
  (s) => s.value !== 'won' && s.value !== 'lost',
).map((s) => ({ value: s.value, label: s.label }));

const OpportunityCreateModal: React.FC<OpportunityCreateModalProps> = ({
  open,
  onOpenChange,
  customerId,
  ownerId,
  existingContacts,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const contactOptions = useMemo(
    () =>
      existingContacts.map((c) => ({
        value: c.id,
        label: [c.name, c.position].filter(Boolean).join(' · '),
      })),
    [existingContacts],
  );

  // primaryContactId 默认值：优先主联系人；否则单联系人时默认。
  const defaultPrimaryContactId = useMemo<number | undefined>(() => {
    const primary = existingContacts.find((c) => c.isPrimary === 1);
    if (primary) return primary.id;
    if (existingContacts.length === 1) return existingContacts[0]?.id;
    return undefined;
  }, [existingContacts]);

  // initialValues —— 由 ModalForm 在 mount 时直接喂给内部 form。
  const initialValues = useMemo<FormValues>(
    () => ({
      name: undefined,
      primaryContactId: defaultPrimaryContactId,
      expectedAmount: undefined,
      stage: 'requirement',
      expectedCloseDate: undefined,
      remark: undefined,
    }),
    [defaultPrimaryContactId],
  );

  // 关闭时 resetFields，避免下次打开残留旧值。
  React.useEffect(() => {
    if (open) return;
    formRef.current?.resetFields();
  }, [open]);

  return (
    <ModalForm<FormValues>
      key="opportunity-create"
      open={open}
      onOpenChange={onOpenChange}
      title="新建商机"
      width={680}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
      }}
      submitter={{
        searchConfig: { submitText: '创建', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (raw) => {
        const name = (raw.name ?? '').trim();
        if (!name) {
          message.error('请输入商机名称');
          return false;
        }
        if (ownerId == null) {
          message.error('客户未指定负责人，无法创建商机');
          return false;
        }

        setSubmitting(true);
        try {
          const input: OpportunityCreateInput = {
            name,
            customerId,
            ownerId,
            primaryContactId: raw.primaryContactId ?? null,
            stage: raw.stage ?? 'requirement',
            amountCents:
              raw.expectedAmount == null
                ? null
                : Math.round(raw.expectedAmount * 100),
            expectedCloseDate: raw.expectedCloseDate
              ? raw.expectedCloseDate.startOf('day').toISOString()
              : undefined,
            remark: raw.remark?.trim() || undefined,
          };
          const saved = await createOpportunity(input);
          message.success('商机创建成功');
          onSuccess?.(saved);
          onOpenChange(false);
          return true;
        } catch (err) {
          message.error(err instanceof Error ? err.message : '商机创建失败');
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <ProFormText
        name="name"
        label="商机名称"
        placeholder="请输入商机名称"
        rules={[
          { required: true, whitespace: true, message: '请输入商机名称' },
          { max: 100, message: '商机名称最多 100 个字符' },
        ]}
      />
      <Row gutter={24}>
        <Col span={12}>
          <ProFormSelect
            name="primaryContactId"
            label="联系人"
            placeholder={
              existingContacts.length ? '请选择联系人' : '暂无联系人'
            }
            options={contactOptions}
            allowClear
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
      </Row>
      <Row gutter={24}>
        <Col span={12}>
          <ProFormSelect
            name="stage"
            label="销售阶段"
            placeholder="请选择销售阶段"
            options={stageOptions}
            rules={[{ required: true, message: '请选择销售阶段' }]}
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
      </Row>
      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="补充客户需求、背景或其他信息"
        fieldProps={{ rows: 3, maxLength: 500, showCount: true }}
      />
    </ModalForm>
  );
};

export default OpportunityCreateModal;
