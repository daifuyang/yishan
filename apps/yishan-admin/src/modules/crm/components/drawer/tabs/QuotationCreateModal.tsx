/**
 * 报价单创建 Modal（浮在客户详情 Drawer 之上）。
 *
 * 设计原则：
 *   - 不暴露「所属客户」「负责人」（由上下文确定）
 *   - 字段按 spec：报价单名称 / 关联商机 / 联系人 / 有效期 / 报价明细 / 整单优惠 / 备注
 *   - 沿用 ContactCreateModal 的 controlled-open + formRef + useState submitting + try/finally 模式
 *   - 金额走 transform：明细行 unitPrice yuan → cents × 100；整单优惠同样 × 100
 *   - 失败保留用户已输入的数据（Modal 不关）
 *   - 仅 create 模式（编辑流后续独立做）
 *
 * 明细行：使用本地 React state（不用 Form.List）：
 *   - 每行 { key, productId?, name, spec?, unit?, quantity, unitPriceYuan }
 *   - subtotalYuan = quantity × unitPriceYuan，只读展示
 *   - 添加商品（选 productId 自动回填）/ 添加自定义项（productId=null 手填）
 *   - 头部 `name` 智能默认：商机名 + '报价单' / 客户名 + '报价单'
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
import {
  App,
  Button,
  Col,
  Divider,
  Empty,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
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

interface FormValues {
  name?: string;
  opportunityId?: number;
  contactId?: number;
  validUntil?: Dayjs;
  discountAmountYuan?: number;
  remark?: string;
}

interface ItemRow {
  /** React key，必须稳定。 */
  key: string;
  /** null 表示自定义项。 */
  productId: number | null;
  name: string;
  /** 规格 / 描述（unitSnapshot）。 */
  spec: string;
  /** 单位（unitSnapshot 的可读化展示）。 */
  unit: string;
  quantity: number;
  /** unitPriceCents / 100，UI 用 yuan 数字。 */
  unitPriceYuan: number;
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

const newRowKey = () =>
  `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
  const formRef = useRef<ProFormInstance | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([]);

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
              : ` ¥${(o.amountCents / 100).toLocaleString('zh-CN')}`;
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
            label: `${o.name}${amount ? ` · ${amount.replace(' ¥', '¥')}` : ''} · ${stageLabel}`,
          };
        }),
    [existingOpportunities],
  );

  /** 智能默认 name：机会名 → 客户名。 */
  const defaultName = useMemo(() => {
    const firstOpp = existingOpportunities[0];
    if (firstOpp?.name) return `${firstOpp.name}报价单`;
    if (customerName) return `${customerName}报价单`;
    return undefined;
  }, [existingOpportunities, customerName]);

  /** initialValues：name 默认、items 通过 React state 管理（不在 form 中）。 */
  const initialValues = useMemo<FormValues>(
    () => ({
      name: defaultName,
      opportunityId: undefined,
      contactId: undefined,
      validUntil: undefined,
      discountAmountYuan: undefined,
      remark: undefined,
    }),
    [defaultName],
  );

  /** 关闭时清理。 */
  useEffect(() => {
    if (open) return;
    formRef.current?.resetFields();
    setItems([]);
  }, [open]);

  /** 商品金额（明细 sum）与报价总额（max(0, 商品金额 − 优惠)）。 */
  const totals = useMemo(() => {
    const itemsTotal = items.reduce(
      (sum, it) => sum + it.quantity * it.unitPriceYuan,
      0,
    );
    return { itemsTotal };
  }, [items]);

  const updateItem = (key: string, patch: Partial<ItemRow>) => {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, ...patch } : it)),
    );
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const addProductRow = () => {
    setItems((prev) => [
      ...prev,
      {
        key: newRowKey(),
        productId: null,
        name: '',
        spec: '',
        unit: '',
        quantity: 1,
        unitPriceYuan: 0,
      },
    ]);
  };

  const addCustomRow = () => {
    setItems((prev) => [
      ...prev,
      {
        key: newRowKey(),
        productId: null,
        name: '',
        spec: '',
        unit: '',
        quantity: 1,
        unitPriceYuan: 0,
      },
    ]);
  };

  const handleProductChange = (key: string, productId: number | null) => {
    if (productId == null) {
      updateItem(key, { productId: null });
      return;
    }
    const product = existingProducts.find((p) => p.id === productId);
    if (!product) {
      updateItem(key, { productId });
      return;
    }
    updateItem(key, {
      productId: product.id,
      name: product.name,
      spec: product.description ?? '',
      unit: product.unitName ?? product.unitCode ?? '',
      unitPriceYuan: product.standardPriceCents / 100,
    });
  };

  return (
    <ModalForm<FormValues>
      key="quotation-create"
      open={open}
      onOpenChange={onOpenChange}
      title="新建报价单"
      width={920}
      layout="vertical"
      autoFocusFirstInput
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        zIndex: CRM_DIALOG_Z_INDEX,
        styles: {
          body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' },
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
        const validItems = items.filter(
          (it) =>
            it.name.trim() !== '' && it.quantity > 0 && it.unitPriceYuan >= 0,
        );
        if (validItems.length === 0) {
          message.error('请至少添加一条报价明细');
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
            productId: it.productId,
            productNameSnapshot: it.name.trim(),
            unitSnapshot: it.spec?.trim() || null,
            quantityCents: Math.round(it.quantity * 10000),
            unitPriceCents: Math.round(it.unitPriceYuan * 100),
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
      <Divider titlePlacement="left" plain style={{ margin: '0 0 12px' }}>
        <Text strong>基本信息</Text>
      </Divider>

      <ProFormText
        name="name"
        label="报价单名称"
        placeholder="请输入报价单名称"
        rules={[
          { required: true, whitespace: true, message: '请填写报价单名称' },
          { max: 200, message: '名称最多 200 个字符' },
        ]}
      />

      <Row gutter={24}>
        <Col span={12}>
          <ProFormSelect
            name="opportunityId"
            label="关联商机"
            placeholder={
              opportunityOptions.length ? '请选择商机（可选）' : '暂无商机'
            }
            options={opportunityOptions}
            allowClear
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="contactId"
            label="联系人"
            placeholder={
              contactOptions.length ? '请选择联系人（可选）' : '暂无联系人'
            }
            options={contactOptions}
            allowClear
          />
        </Col>
      </Row>

      <ProFormDatePicker
        name="validUntil"
        label="有效期至"
        placeholder="请选择有效期（可选）"
        fieldProps={{ format: 'YYYY-MM-DD', style: { width: '100%' } }}
      />

      <Divider titlePlacement="left" plain style={{ margin: '12px 0' }}>
        <Text strong>报价明细</Text>
      </Divider>

      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="还没有添加报价项"
          style={{ margin: '16px 0' }}
        />
      ) : (
        <div
          style={{
            border: '1px solid #f0f0f0',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {/* header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(160px, 2fr) minmax(120px, 1.5fr) 90px 130px 110px 60px',
              gap: 8,
              padding: '8px 12px',
              background: '#fafafa',
              fontSize: 12,
              color: '#595959',
            }}
          >
            <span>商品 / 服务</span>
            <span>规格</span>
            <span style={{ textAlign: 'right' }}>数量</span>
            <span style={{ textAlign: 'right' }}>单价</span>
            <span style={{ textAlign: 'right' }}>小计</span>
            <span />
          </div>
          {items.map((it) => {
            const subtotal = it.quantity * it.unitPriceYuan;
            return (
              <div
                key={it.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(160px, 2fr) minmax(120px, 1.5fr) 90px 130px 110px 60px',
                  gap: 8,
                  padding: '8px 12px',
                  borderTop: '1px solid #f0f0f0',
                  alignItems: 'center',
                }}
              >
                {it.productId ? (
                  <Select
                    value={it.productId}
                    showSearch
                    optionFilterProp="label"
                    style={{ width: '100%' }}
                    options={productOptions}
                    onChange={(v) => handleProductChange(it.key, v ?? null)}
                    placeholder="选择商品"
                  />
                ) : (
                  <Input
                    value={it.name}
                    onChange={(e) =>
                      updateItem(it.key, { name: e.target.value })
                    }
                    placeholder="自定义项名称"
                  />
                )}
                <Input
                  value={it.spec}
                  onChange={(e) => updateItem(it.key, { spec: e.target.value })}
                  placeholder="规格 / 说明"
                />
                <InputNumber
                  value={it.quantity}
                  onChange={(v) =>
                    updateItem(it.key, {
                      quantity: typeof v === 'number' ? v : 0,
                    })
                  }
                  min={0}
                  step={1}
                  precision={0}
                  style={{ width: '100%' }}
                  addonAfter={it.unit || undefined}
                />
                <InputNumber
                  value={it.unitPriceYuan}
                  onChange={(v) =>
                    updateItem(it.key, {
                      unitPriceYuan: typeof v === 'number' ? v : 0,
                    })
                  }
                  min={0}
                  step={0.01}
                  precision={2}
                  prefix="¥"
                  style={{ width: '100%' }}
                />
                <Text
                  strong
                  style={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {money(Math.round(subtotal * 100))}
                </Text>
                <Button
                  type="text"
                  size="small"
                  onClick={() => removeItem(it.key)}
                  danger
                >
                  删除
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <Space style={{ marginTop: 12 }}>
        <Button
          onClick={() => {
            if (productOptions.length === 0) {
              message.info('当前没有可用商品，将添加自定义项');
              addCustomRow();
              return;
            }
            addProductRow();
          }}
        >
          + 添加报价项
        </Button>
        <Button onClick={addCustomRow}>+ 添加自定义项</Button>
      </Space>

      {/* 金额汇总 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid #f0f0f0',
        }}
      >
        <div style={{ minWidth: 320 }}>
          <Row
            justify="space-between"
            align="middle"
            style={{ marginBottom: 8 }}
          >
            <Col>商品金额</Col>
            <Col style={{ fontVariantNumeric: 'tabular-nums' }}>
              {money(Math.round(totals.itemsTotal * 100))}
            </Col>
          </Row>
          <Row
            justify="space-between"
            align="middle"
            style={{ marginBottom: 12 }}
          >
            <Col>优惠金额</Col>
            <Col style={{ width: 180 }}>
              <ProFormDigit
                name="discountAmountYuan"
                fieldProps={{
                  min: 0,
                  precision: 2,
                  prefix: '-¥',
                  style: { width: '100%' },
                }}
              />
            </Col>
          </Row>
          <Row
            justify="space-between"
            align="middle"
            style={{
              paddingTop: 8,
              borderTop: '1px solid #f0f0f0',
            }}
          >
            <Col>
              <Text strong style={{ fontSize: 16 }}>
                报价总额
              </Text>
            </Col>
            <Col>
              <Text
                strong
                style={{
                  fontSize: 18,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {money(Math.round(Math.max(0, totals.itemsTotal) * 100))}
              </Text>
            </Col>
          </Row>
        </div>
      </div>

      <Divider titlePlacement="left" plain style={{ margin: '12px 0' }}>
        <Text strong>备注</Text>
      </Divider>

      <ProFormTextArea
        name="remark"
        label=""
        placeholder="补充报价说明、交付条件等（可选）"
        fieldProps={{ rows: 3, maxLength: 500, showCount: true }}
      />
    </ModalForm>
  );
};

export default QuotationCreateModal;
