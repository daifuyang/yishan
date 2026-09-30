/**
 * 报价单创建 Modal（浮在客户详情 Drawer 之上）。
 *
 * 设计原则（按紧凑化重构）：
 *   - 不暴露「所属客户」「负责人」（由上下文确定）
 *   - 沿用 ContactCreateModal 的 controlled-open + formRef + useState submitting + try/finally 模式
 *   - 顶部三列栅格（商机 / 联系人 / 有效期）减少纵向空间
 *   - 报价明细用 Form.List（items 在 form values 内），避免本地 React state 双源
 *   - 默认 1 条空明细；「+ 添加报价项」由 Form.List.add 接管
 *   - 单一「+ 添加报价项」入口；行内 productId Select 自然支持「+ 添加自定义项目」分支
 *   - 删除按钮降噪：DeleteOutlined + text 样式，hover 才红
 *   - Modal 尺寸 width=1000 + maxWidth 响应式 + Body 独立滚动
 *
 * 仅 create 模式（编辑流后续单独做）。失败保留用户已输入数据，Modal 不关。
 */

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import type { Dayjs } from 'dayjs';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type ContactRow,
  createQuotation,
  type OpportunityRow,
  type ProductRow,
  type QuotationCreateInput,
  type QuotationResp,
} from '@/services/crm';
import { CRM_DIALOG_Z_INDEX } from '../_shared/crmDialogZIndex';

const { Text } = Typography;

export interface QuotationCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  customerName?: string;
  existingContacts: ContactRow[];
  existingOpportunities: OpportunityRow[];
  existingProducts: ProductRow[];
  onSuccess?: (quotation: QuotationResp) => void;
}

interface ItemValues {
  productId?: number | null;
  name?: string;
  spec?: string;
  quantity?: number;
  unitPriceYuan?: number;
}

interface FormValues {
  name?: string;
  opportunityId?: number;
  contactId?: number;
  validUntil?: Dayjs;
  discountAmountYuan?: number;
  remark?: string;
  items?: ItemValues[];
}

const money = (cents: number | null | undefined) =>
  cents == null
    ? '—'
    : new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);

/**
 * 报价明细单行 —— 由 Form.List 渲染。
 *   - productId：标准商品 Select（支持「+ 添加自定义项目」分支）
 *   - name / spec / quantity / unitPriceYuan：可编辑
 *   - subtotal：实时计算（quantity × unitPriceYuan），只读
 *   - 删除：DeleteOutlined + Tooltip
 */
interface ItemRowProps {
  /** Form.List 提供的数组下标（字段路径段）。 */
  index: number;
  /** 该行在 Form.List 里的 field 名（用于 Form.Item name={…}）。 */
  fieldName: number;
  /** 标准商品 options（label = 商品名，value = productId）。 */
  productOptions: Array<{ value: number; label: string; data: ProductRow }>;
  /** 删除该行。 */
  onRemove: (name: number) => void;
}

const ItemRow: React.FC<ItemRowProps> = ({
  index,
  fieldName,
  productOptions,
  onRemove,
}) => {
  const form = Form.useFormInstance();
  const itemValue = Form.useWatch(['items', index], form) ?? {};
  const quantity = itemValue.quantity ?? 0;
  const unitPriceYuan = itemValue.unitPriceYuan ?? 0;
  const subtotal = quantity * unitPriceYuan;

  const handleProductChange = (productId: number | null) => {
    if (productId == null) {
      form.setFieldValue(['items', index, 'productId'], null);
      return;
    }
    const product = productOptions.find((p) => p.value === productId);
    if (!product) {
      form.setFieldValue(['items', index, 'productId'], productId);
      return;
    }
    // 自动回填名称 / 规格 / 单位 / 单价（用户仍可继续编辑覆盖）
    const currentItems: ItemValues[] = form.getFieldValue('items') ?? [];
    const next = currentItems.map((it, idx) =>
      idx === index
        ? {
            ...it,
            productId: product.value,
            name: product.label,
            unitPriceYuan: product.data.standardPriceCents / 100,
            spec: it.spec ?? product.data.description ?? '',
          }
        : it,
    );
    form.setFieldsValue({ items: next });
  };

  return (
    <Row gutter={8} align="middle" wrap={false} style={{ marginBottom: 8 }}>
      <Col flex="1.4">
        <Form.Item name={[fieldName, 'productId']} noStyle>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="选择商品或自定义"
            style={{ width: '100%' }}
            options={productOptions}
            onChange={(v) => handleProductChange(v ?? null)}
            dropdownRender={(menu) => (
              <>
                {menu}
                {productOptions.length > 0 && (
                  <div
                    style={{
                      borderTop: '1px solid #f0f0f0',
                      margin: '4px 0',
                    }}
                  />
                )}
                <div
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: '#1677ff',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleProductChange(null)}
                >
                  + 添加自定义项目
                </div>
              </>
            )}
          />
        </Form.Item>
      </Col>
      <Col flex="1.1">
        <Form.Item name={[fieldName, 'name']} noStyle>
          <Input placeholder="项目名称" />
        </Form.Item>
      </Col>
      <Col flex="90px">
        <Form.Item name={[fieldName, 'quantity']} noStyle>
          <InputNumber
            min={1}
            step={1}
            precision={0}
            defaultValue={1}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Col>
      <Col flex="130px">
        <Form.Item name={[fieldName, 'unitPriceYuan']} noStyle>
          <InputNumber
            min={0}
            step={0.01}
            precision={2}
            prefix="¥"
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Col>
      <Col
        flex="110px"
        style={{
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 500,
        }}
      >
        {money(Math.round(subtotal * 100))}
      </Col>
      <Col flex="64px" style={{ textAlign: 'center' }}>
        <Tooltip title="删除">
          <Button
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => onRemove(fieldName)}
          />
        </Tooltip>
      </Col>
    </Row>
  );
};

/** 金额汇总；订阅 items + discountAmountYuan，实时算出报价总额。 */
const SummarySection: React.FC = () => {
  const form = Form.useFormInstance();
  const items = Form.useWatch('items', form) ?? [];
  const discountYuan = Form.useWatch('discountAmountYuan', form) ?? 0;

  const itemsTotal = items.reduce(
    (sum: number, it: ItemValues | undefined) =>
      sum + (it?.quantity ?? 0) * (it?.unitPriceYuan ?? 0),
    0,
  );
  const totalCents = Math.max(
    0,
    Math.round(itemsTotal * 100) - Math.round(discountYuan * 100),
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
      <div style={{ width: 320 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
          <Col>
            <Text>商品金额</Text>
          </Col>
          <Col style={{ fontVariantNumeric: 'tabular-nums' }}>
            {money(Math.round(itemsTotal * 100))}
          </Col>
        </Row>
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: 12 }}
        >
          <Col>
            <Text>优惠金额</Text>
          </Col>
          <Col style={{ width: 160 }}>
            <Form.Item name="discountAmountYuan" noStyle>
              <InputNumber
                min={0}
                step={0.01}
                precision={2}
                prefix="-¥"
                placeholder="0.00"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row
          justify="space-between"
          align="middle"
          style={{ paddingTop: 8, borderTop: '1px solid #f0f0f0' }}
        >
          <Col>
            <Text strong style={{ fontSize: 16 }}>
              报价总额
            </Text>
          </Col>
          <Col>
            <Text
              strong
              style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}
            >
              {money(totalCents)}
            </Text>
          </Col>
        </Row>
      </div>
    </div>
  );
};

const QuotationCreateModal: React.FC<QuotationCreateModalProps> = ({
  open,
  onOpenChange,
  customerId,
  customerName,
  existingContacts,
  existingOpportunities,
  existingProducts,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance<FormValues>>(undefined);
  const [submitting, setSubmitting] = useState(false);

  const productOptions = useMemo(
    () =>
      existingProducts
        .filter((p) => p.enabled === 1)
        .map((p) => ({
          value: p.id,
          label: p.name,
          data: p,
        })),
    [existingProducts],
  );

  const contactOptions = useMemo(
    () =>
      existingContacts.map((c) => ({
        value: c.id,
        label: [c.name, c.position].filter(Boolean).join(' · '),
      })),
    [existingContacts],
  );

  const opportunityOptions = useMemo(
    () =>
      existingOpportunities
        .filter((o) => o.stage !== 'won' && o.stage !== 'lost')
        .map((o) => {
          const amount =
            o.amountCents == null
              ? ''
              : `¥${(o.amountCents / 100).toLocaleString('zh-CN')} `;
          const stageLabel =
            o.stage === 'requirement'
              ? '需求确认'
              : o.stage === 'proposal'
                ? '方案报价'
                : o.stage === 'negotiation'
                  ? '商务谈判'
                  : o.stage;
          return {
            value: o.id,
            label: `${o.name} · ${amount}${stageLabel}`,
          };
        }),
    [existingOpportunities],
  );

  /** 智能默认 name：第一个商机名 + '报价单' / 客户名 + '报价单'。 */
  const defaultName = useMemo(() => {
    const firstOpp = existingOpportunities[0];
    if (firstOpp?.name) return `${firstOpp.name}报价单`;
    if (customerName) return `${customerName}报价单`;
    return undefined;
  }, [existingOpportunities, customerName]);

  const initialValues = useMemo<FormValues>(
    () => ({
      name: defaultName,
      opportunityId: undefined,
      contactId: undefined,
      validUntil: undefined,
      discountAmountYuan: undefined,
      remark: undefined,
      items: [
        {
          productId: undefined,
          name: '',
          spec: '',
          quantity: 1,
          unitPriceYuan: 0,
        },
      ],
    }),
    [defaultName],
  );

  // 关闭时清空 Form（含 items）。
  useEffect(() => {
    if (open) return;
    formRef.current?.resetFields();
  }, [open]);

  return (
    <ModalForm<FormValues>
      key="quotation-create"
      open={open}
      onOpenChange={onOpenChange}
      title="新建报价单"
      width={1000}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
        width: 1000,
        style: { maxWidth: 'calc(100vw - 48px)' },
        styles: {
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowX: 'hidden',
            overflowY: 'auto',
            padding: '16px 24px',
          },
        },
      }}
      submitter={{
        searchConfig: { submitText: '创建', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (raw) => {
        const name = (raw.name ?? '').trim();
        if (!name) {
          message.error('请填写报价单名称');
          return false;
        }
        const validItems = (raw.items ?? []).filter(
          (it) =>
            (it.name ?? '').trim() !== '' &&
            (it.quantity ?? 0) > 0 &&
            (it.unitPriceYuan ?? 0) >= 0,
        );
        if (validItems.length === 0) {
          message.error('请至少添加一条有效报价明细');
          return false;
        }

        const discountYuan = Math.max(0, raw.discountAmountYuan ?? 0);
        const input: QuotationCreateInput = {
          customerId,
          name,
          opportunityId: raw.opportunityId ?? null,
          contactId: raw.contactId ?? null,
          validUntil: raw.validUntil
            ? raw.validUntil.startOf('day').toISOString()
            : undefined,
          discountAmountCents:
            discountYuan > 0 ? Math.round(discountYuan * 100) : undefined,
          remark: raw.remark?.trim() || undefined,
          items: validItems.map((it) => ({
            productId: it.productId ?? null,
            productNameSnapshot: (it.name ?? '').trim(),
            unitSnapshot: (it.spec ?? '').trim() || null,
            quantityCents: Math.round((it.quantity ?? 0) * 10000),
            unitPriceCents: Math.round((it.unitPriceYuan ?? 0) * 100),
          })),
        };

        setSubmitting(true);
        try {
          const saved = await createQuotation(input);
          message.success('报价单创建成功');
          onSuccess?.(saved);
          onOpenChange(false);
          return true;
        } catch (err) {
          message.error(err instanceof Error ? err.message : '报价单创建失败');
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {/* 顶部：报价单名称 */}
      <ProFormText
        name="name"
        label="报价单名称"
        placeholder="请输入报价单名称"
        rules={[
          { required: true, whitespace: true, message: '请填写报价单名称' },
          { max: 200, message: '名称最多 200 个字符' },
        ]}
      />

      {/* 顶部三列：商机 / 联系人 / 有效期 */}
      <Row gutter={16}>
        <Col span={8}>
          <ProFormSelect
            name="opportunityId"
            label="关联商机"
            placeholder={
              opportunityOptions.length ? '请选择商机（可选）' : '暂无商机'
            }
            options={opportunityOptions}
            allowClear
            disabled={opportunityOptions.length === 0}
          />
        </Col>
        <Col span={8}>
          <ProFormSelect
            name="contactId"
            label="联系人"
            placeholder={
              contactOptions.length ? '请选择联系人（可选）' : '暂无联系人'
            }
            options={contactOptions}
            allowClear
            disabled={contactOptions.length === 0}
          />
        </Col>
        <Col span={8}>
          <ProFormDatePicker
            name="validUntil"
            label="有效期至"
            placeholder="请选择日期（可选）"
            fieldProps={{ format: 'YYYY-MM-DD', style: { width: '100%' } }}
          />
        </Col>
      </Row>

      {/* 报价明细 Section Header + 添加按钮 */}
      <Form.List name="items">
        {(_fields, { add }) => (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            <Text strong style={{ fontSize: 14 }}>
              报价明细
            </Text>
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={() =>
                add({
                  productId: undefined,
                  name: '',
                  spec: '',
                  quantity: 1,
                  unitPriceYuan: 0,
                })
              }
            >
              添加报价项
            </Button>
          </div>
        )}
      </Form.List>

      {/* 报价明细行容器 */}
      <Form.List name="items">
        {(fields, { remove }) =>
          fields.length === 0 ? (
            <Space
              direction="vertical"
              align="center"
              style={{
                width: '100%',
                padding: '24px 0',
                border: '1px dashed #d9d9d9',
                borderRadius: 6,
              }}
            >
              <Text type="secondary">
                暂无报价明细，请点击右上「添加报价项」
              </Text>
            </Space>
          ) : (
            <div
              style={{
                border: '1px solid #f0f0f0',
                borderRadius: 6,
                padding: '8px 12px',
              }}
            >
              {fields.map((field, index) => (
                <ItemRow
                  key={field.key}
                  index={index}
                  fieldName={field.name}
                  productOptions={productOptions}
                  onRemove={remove}
                />
              ))}
            </div>
          )
        }
      </Form.List>

      {/* 金额汇总 */}
      <SummarySection />

      {/* 备注 */}
      <ProFormTextArea
        name="remark"
        label="备注"
        placeholder="补充报价说明、交付条件等（可选）"
        fieldProps={{
          autoSize: { minRows: 2, maxRows: 4 },
          maxLength: 500,
          showCount: true,
        }}
      />
    </ModalForm>
  );
};

export default QuotationCreateModal;
