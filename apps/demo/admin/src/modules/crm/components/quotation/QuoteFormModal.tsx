import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  ModalForm,
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  InputNumber,
  message,
  Row,
  Table,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useRef, useState } from 'react';
import {
  type ContactRow,
  createQuotation,
  getQuotationDuplicates,
  type QuoteSeriesSummary,
  getQuotation,
  updateQuotation,
  listAllPages,
  listContactsByCustomer,
  listOpportunities,
  type OpportunityRow,
} from '@/services/crm';
import { usePermission } from '@/utils/permission';
import { OPPORTUNITY_STAGES, statusOf } from '../../domain/statuses';
import {
  formatQuoteMoney,
  formatQuoteNumberInput,
  lineAmountCents,
  quoteTotals,
  yuanToCents,
} from '../../utils/quotationMoney';
import { CRM_DIALOG_Z_INDEX } from '../drawer/_shared/crmDialogZIndex';
import { QUOTATION_CHANGED_EVENT } from '../../utils/crmEvents';
import { getQuoteActions } from '../../domain/quoteActions';

interface ItemValues {
  name: string;
  description?: string;
  unit?: string;
  quantity: number;
  unitPriceYuan: number;
  productId?: number | null;
  discountBp?: number;
  taxRateBp?: number;
}
interface FormValues {
  name: string;
  opportunityId: number;
  contactId: number;
  quoteDate: string;
  validUntil: string;
  discountAmountYuan?: number;
  publicDiscountDescription?: string;
  internalDiscountReason?: string;
  remark?: string;
  items: ItemValues[];
}
const emptyItem = (): ItemValues => ({
  name: '',
  quantity: 1,
  unitPriceYuan: 0,
});

function AmountSummary() {
  const form = Form.useFormInstance<FormValues>();
  const items: ItemValues[] = Form.useWatch('items', form) ?? [];
  const discount: number = Form.useWatch('discountAmountYuan', form) ?? 0;
  const totals = quoteTotals(items, discount);
  return (
    <Flex
      vertical
      gap={12}
      style={{
        margin: '24px 0',
        width: 320,
        maxWidth: '100%',
        marginLeft: 'auto',
      }}
    >
      <Flex justify="space-between">
        <Typography.Text type="secondary">小计</Typography.Text>
        <Typography.Text>{formatQuoteMoney(totals.subtotal)}</Typography.Text>
      </Flex>
      <Flex align="baseline" justify="space-between" gap={16}>
        <Typography.Text>优惠金额</Typography.Text>
        <Form.Item
          name="discountAmountYuan"
          dependencies={['items']}
          rules={[
            {
              validator: async (_, value: number) => {
                const subtotal = quoteTotals(
                  form.getFieldValue('items') ?? [],
                  0,
                ).subtotal;
                if (value < 0) throw new Error('优惠金额不能小于0');
                if (yuanToCents(value ?? 0) > subtotal)
                  throw new Error('优惠不能超过小计');
              },
            },
          ]}
          style={{ marginBottom: 0 }}
        >
          <InputNumber
            min={0}
            precision={2}
            prefix="¥"
            formatter={formatQuoteNumberInput}
            parser={(value) => Number(value?.replaceAll(',', '') || 0)}
            style={{ width: 176 }}
            aria-label="优惠金额"
          />
        </Form.Item>
      </Flex>
      {discount > 0 && (
        <>
          <Flex align="baseline" justify="space-between" gap={16}>
            <Typography.Text>优惠说明</Typography.Text>
            <Form.Item
              name="publicDiscountDescription"
              rules={[{ max: 50 }]}
              style={{ marginBottom: 0 }}
            >
              <Input
                aria-label="对外优惠说明"
                placeholder="例如：首期合作优惠"
                maxLength={50}
                style={{ width: 176 }}
              />
            </Form.Item>
          </Flex>
          <Typography.Text type="secondary" style={{ textAlign: 'right' }}>
            优惠 -{formatQuoteMoney(totals.discount)}
          </Typography.Text>
        </>
      )}
      <Divider style={{ margin: 0 }} />
      <Flex align="center" justify="space-between">
        <Typography.Text strong>报价金额</Typography.Text>
        <Typography.Text strong style={{ fontSize: 20 }}>
          {formatQuoteMoney(totals.total)}
        </Typography.Text>
      </Flex>
    </Flex>
  );
}

export default function QuoteFormModal({
  quotationId,
  onSaved,
  onClosed,
  opportunity,
  customerId,
  customerName,
  requestKey,
  onRequestHandled,
  renderTrigger,
  onChanged,
}: {
  quotationId?: number;
  onSaved?: (id: number) => void;
  onClosed?: () => void;
  opportunity?: OpportunityRow;
  customerId?: number;
  customerName?: string;
  requestKey?: number;
  onRequestHandled?: () => void;
  renderTrigger?: (openQuoteCreateModal: () => void) => React.ReactNode;
  onChanged?: () => void | Promise<void>;
}) {
  const can = usePermission();
  const [notice, noticeHolder] = message.useMessage();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [error, setError] = useState<string>();
  const [duplicateSeries, setDuplicateSeries] = useState<QuoteSeriesSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const previousRequest = useRef(0);
  const validUntilEdited = useRef(false);
  const nameEdited = useRef(false);
  const discount = Form.useWatch('discountAmountYuan', form) ?? 0;
  const selectedId = Form.useWatch('opportunityId', form);
  const selected =
    opportunity ?? opportunities.find((row) => row.id === selectedId);
  const contextCustomerId = opportunity?.customerId ?? customerId;
  const openQuoteCreateModal = () => {
    if (!can(quotationId ? 'crm:quotation:update' : 'crm:quotation:create'))
      return;
    form.resetFields();
    validUntilEdited.current = false;
    nameEdited.current = false;
    setError(undefined);
    setOpen(true);
  };
  useEffect(() => {
    if (!requestKey) {
      previousRequest.current = 0;
      return;
    }
    if (requestKey !== previousRequest.current) {
      previousRequest.current = requestKey;
      if (can(quotationId ? 'crm:quotation:update' : 'crm:quotation:create')) {
        form.resetFields();
        validUntilEdited.current = false;
        nameEdited.current = false;
        setOpen(true);
        onRequestHandled?.();
      }
    }
  }, [requestKey]);
  useEffect(() => {
    if (!open || !contextCustomerId) return;
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    Promise.all([
      listContactsByCustomer(contextCustomerId),
      opportunity
        ? Promise.resolve([opportunity])
        : listAllPages((page, pageSize) =>
            listOpportunities({
              customerId: contextCustomerId,
              page,
              pageSize,
            }),
          ),
      quotationId ? getQuotation(quotationId) : Promise.resolve(null),
    ])
      .then(([people, rows, quote]) => {
        if (cancelled) return;
        setContacts(people);
        setOpportunities(rows);
        const row = opportunity;
        if (quote) {
          if (!getQuoteActions(quote, can).canEdit)
            throw new Error('该报价已锁定，不能编辑');
          form.setFieldsValue({
            name: quote.name,
            opportunityId: quote.opportunityId ?? undefined,
            contactId: quote.contactId ?? undefined,
            quoteDate: quote.quoteDate
              ? dayjs(quote.quoteDate).format('YYYY-MM-DD')
              : undefined,
            validUntil: quote.validUntil
              ? dayjs(quote.validUntil).format('YYYY-MM-DD')
              : undefined,
            discountAmountYuan: quote.discountAmountCents / 100,
            publicDiscountDescription: quote.publicDiscountDescription ?? '',
            internalDiscountReason: quote.internalDiscountReason ?? '',
            remark: quote.remark ?? '',
            items: quote.items.map((item) => ({
              name: item.productNameSnapshot,
              description: item.description ?? '',
              unit: item.unitSnapshot ?? '',
              quantity: item.quantityCents / 10000,
              unitPriceYuan: item.unitPriceCents / 100,
              productId: item.productId,
              discountBp: item.discountBp,
              taxRateBp: item.taxRateBp,
            })),
          });
          nameEdited.current = true;
          validUntilEdited.current = true;
          return;
        }
        form.setFieldsValue({
          contactId:
            people.find((person) => person.id === row?.primaryContactId)?.id ??
            people.find((person) => person.isPrimary === 1)?.id ??
            (people.length === 1 ? people[0].id : undefined),
        });
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : '关联信息加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, contextCustomerId, opportunity?.id, quotationId]);
  const watchedName = Form.useWatch('name', form);
  useEffect(() => {
    if (!open || quotationId || !selected?.id || !watchedName?.trim()) {
      setDuplicateSeries([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (typeof getQuotationDuplicates !== 'function') return;
      void getQuotationDuplicates(selected.id, watchedName.trim())
        .then((rows: QuoteSeriesSummary[]) => {
          if (!cancelled) setDuplicateSeries(rows);
        })
        .catch(() => {
          if (!cancelled) setDuplicateSeries([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, quotationId, selected?.id, watchedName]);
  return (
    <>
      {noticeHolder}
      {can(quotationId ? 'crm:quotation:update' : 'crm:quotation:create') &&
        renderTrigger?.(openQuoteCreateModal)}
      <ModalForm<FormValues>
        form={form}
        open={open}
        onOpenChange={(visible) => {
          setOpen(visible);
          if (!visible) onClosed?.();
        }}
        title={
          <Flex vertical gap={4}>
            <span>{quotationId ? '编辑报价' : '新建报价'}</span>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 13, fontWeight: 400 }}
            >
              {[selected?.customerName || customerName, selected?.name]
                .filter(Boolean)
                .join(' · ')}
            </Typography.Text>
          </Flex>
        }
        width="min(1000px, calc(100vw - 32px))"
        layout="vertical"
        onValuesChange={(changed) => {
          if ('name' in changed) nameEdited.current = true;
          if ('opportunityId' in changed && !nameEdited.current) {
            const nextOpportunity = opportunities.find(
              (row) => row.id === changed.opportunityId,
            );
            if (nextOpportunity)
              form.setFieldValue('name', `${nextOpportunity.name}报价`.slice(0, 100));
          }
          if ('validUntil' in changed) validUntilEdited.current = true;
          if (
            'quoteDate' in changed &&
            changed.quoteDate &&
            !validUntilEdited.current
          ) {
            form.setFieldsValue({
              validUntil: dayjs(changed.quoteDate)
                .add(7, 'day')
                .format('YYYY-MM-DD'),
            });
          }
        }}
        initialValues={{
          name: opportunity
            ? `${opportunity.name}报价`.slice(0, 100)
            : '',
          opportunityId: opportunity?.id,
          quoteDate: dayjs().format('YYYY-MM-DD'),
          validUntil: dayjs().add(7, 'day').format('YYYY-MM-DD'),
          discountAmountYuan: 0,
          items: [emptyItem()],
        }}
        modalProps={{
          destroyOnHidden: true,
          mask: { closable: false },
          zIndex: CRM_DIALOG_Z_INDEX + (quotationId ? 30 : 10),
          style: { maxWidth: 'calc(100vw - 32px)' },
        }}
        submitter={{
          searchConfig: { submitText: '保存', resetText: '取消' },
          submitButtonProps: { disabled: loading || Boolean(error) },
        }}
        onFinish={async (values) => {
          if (!selected || !contextCustomerId) {
            notice.error('请选择商机');
            return false;
          }
          if (!values.items?.length) {
            notice.error('至少添加一条报价明细');
            return false;
          }
          const totals = quoteTotals(
            values.items,
            values.discountAmountYuan ?? 0,
          );
          if (totals.discount < 0 || totals.discount > totals.subtotal) {
            notice.error('优惠不能超过小计');
            return false;
          }
          try {
            const input = {
              customerId: contextCustomerId,
              opportunityId: selected.id,
              contactId: values.contactId,
              name: values.name.trim(),
              quoteDate: dayjs(values.quoteDate).startOf('day').toISOString(),
              validUntil: dayjs(values.validUntil).startOf('day').toISOString(),
              discountAmountCents: totals.discount,
              publicDiscountDescription:
                totals.discount > 0
                  ? values.publicDiscountDescription?.trim()
                  : undefined,
              internalDiscountReason:
                totals.discount > 0
                  ? values.internalDiscountReason?.trim()
                  : undefined,
              remark: values.remark?.trim(),
              items: values.items.map((item) => ({
                productId: item.productId ?? null,
                productNameSnapshot: item.name.trim(),
                description: item.description?.trim(),
                unitSnapshot: item.unit?.trim() || undefined,
                quantityCents: Math.round(item.quantity * 10000),
                unitPriceCents: yuanToCents(item.unitPriceYuan),
                discountBp: item.discountBp ?? 0,
                taxRateBp: item.taxRateBp ?? 0,
              })),
            };
            const saved = quotationId
              ? await updateQuotation(quotationId, input)
              : await createQuotation(input);
            notice.success('报价已保存');
            setOpen(false);
            form.resetFields();

            onSaved?.(saved.id);
            window.dispatchEvent(
              new CustomEvent(QUOTATION_CHANGED_EVENT, {
                detail: { customerId: contextCustomerId },
              }),
            );
            try {
              await onChanged?.();
            } catch {
              notice.warning('报价已保存，关联信息刷新失败');
            }
            return true;
          } catch (err) {
            notice.error(err instanceof Error ? err.message : '报价保存失败');
            return false;
          }
        }}
      >
        {error && (
          <Alert type="error" title={error} style={{ marginBottom: 16 }} />
        )}
        {duplicateSeries.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="该商机已有同名报价"
            description={
              <Flex vertical gap={4}>
                {duplicateSeries.map((series, index) => (
                  <Typography.Text key={series.seriesId ?? series.seriesNo ?? index}>
                    {series.title ?? '报价'} · {series.seriesNo ?? '—'} · V{series.currentVersion ?? 1} · {series.ownerUserName || '未分配'}
                  </Typography.Text>
                ))}
                <Typography.Text type="secondary">仍然保存即可创建新的报价系列。</Typography.Text>
              </Flex>
            }
          />
        )}
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <ProFormText
              name="name"
              label="报价名称"
              rules={[{ required: true, whitespace: true }, { max: 100 }]}
              fieldProps={{ maxLength: 100, 'aria-label': '报价名称' }}
            />
          </Col>
          <Col xs={24} md={12}>
            <ProFormSelect
              name="opportunityId"
              label="商机"
              disabled={Boolean(opportunity || quotationId)}
              rules={[{ required: true }]}
              options={(opportunity
                ? [opportunity]
                : opportunities.filter(
                    (row) =>
                      (Boolean(quotationId) && row.id === selectedId) ||
                      row.stage === 'solution' || row.stage === 'quotation',
                  )
              ).map((row) => ({
                value: row.id,
                label: row.name,
                stage: row.stage,
                amountCents: row.amountCents,
              }))}
              fieldProps={{
                optionRender: (option) => (
                  <Flex vertical gap={4}>
                    <span>{option.data.label}</span>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {
                        statusOf(option.data.stage, [...OPPORTUNITY_STAGES])
                          .label
                      }{' '}
                      · {formatQuoteMoney(option.data.amountCents ?? 0)}
                    </Typography.Text>
                  </Flex>
                ),
                onChange: (value) => {
                  const row = opportunities.find((item) => item.id === value);
                  if (row)
                    form.setFieldsValue({
                      ...(!nameEdited.current ||
                      !form.getFieldValue('name')?.trim()
                        ? { name: `${row.name}第一版报价`.slice(0, 100) }
                        : {}),
                      contactId: contacts.find(
                        (person) => person.id === row.primaryContactId,
                      )?.id,
                    });
                },
              }}
            />
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="客户">
              <Typography.Text>
                {selected?.customerName || customerName || '—'}
              </Typography.Text>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <ProFormSelect
              name="contactId"
              label="联系人"
              rules={[{ required: true, message: '请选择当前客户联系人' }]}
              options={contacts.map((contact) => ({
                value: contact.id,
                label: contact.name,
              }))}
            />
          </Col>
          <Col xs={24} md={12}>
            <ProFormDatePicker
              name="quoteDate"
              label="报价日期"
              rules={[{ required: true }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col xs={24} md={12}>
            <ProFormDatePicker
              name="validUntil"
              label="有效期至"
              dependencies={['quoteDate']}
              rules={[
                { required: true },
                {
                  validator: async (_: unknown, value: string | undefined) => {
                    if (
                      value &&
                      dayjs(value).isBefore(
                        dayjs(form.getFieldValue('quoteDate')),
                        'day',
                      )
                    )
                      throw new Error('有效期不能早于报价日期');
                  },
                },
              ]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Form.List
          name="items"
          rules={[
            {
              validator: async (_, items) => {
                if (!items?.length) throw new Error('至少添加一条报价明细');
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              <Flex align="center" justify="space-between">
                <Typography.Text strong>报价明细</Typography.Text>
                <Button
                  type="link"
                  icon={<PlusOutlined />}
                  onClick={() => add(emptyItem())}
                >
                  添加报价项
                </Button>
              </Flex>
              <Form.Item noStyle shouldUpdate>
                {() => (
                  <Table
                    rowKey="key"
                    dataSource={fields}
                    pagination={false}
                    size="small"
                    scroll={{ x: 850 }}
                    columns={[
                      {
                        title: '项目名称',
                        width: 175,
                        render: (_, field) => (
                          <Form.Item
                            name={[field.name, 'name']}
                            rules={[
                              {
                                required: true,
                                whitespace: true,
                                message: '填写项目名称',
                              },
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <Input
                              aria-label={`项目名称${field.name + 1}`}
                              maxLength={200}
                            />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '描述',
                        width: 220,
                        render: (_, field) => (
                          <Form.Item
                            name={[field.name, 'description']}
                            style={{ marginBottom: 0 }}
                          >
                            <Input.TextArea
                              aria-label={`描述${field.name + 1}`}
                              autoSize={{ minRows: 1, maxRows: 4 }}
                              maxLength={2000}
                            />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '数量 / 规格',
                        width: 160,
                        render: (_, field) => (
                          <Flex gap={4}>
                            <Form.Item
                              name={[field.name, 'quantity']}
                              rules={[{ required: true }]}
                              style={{ marginBottom: 0 }}
                            >
                              <InputNumber
                                aria-label={`数量${field.name + 1}`}
                                min={0.0001}
                                max={214748.3647}
                                precision={4}
                                formatter={formatQuoteNumberInput}
                                parser={(value) =>
                                  Number(value?.replaceAll(',', '') || 0)
                                }
                                style={{ width: 90 }}
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, 'unit']}
                              style={{ marginBottom: 0 }}
                            >
                              <Input
                                aria-label={`单位${field.name + 1}`}
                                placeholder="单位"
                                maxLength={64}
                              />
                            </Form.Item>
                          </Flex>
                        ),
                      },
                      {
                        title: '单价',
                        width: 135,
                        render: (_, field) => (
                          <Form.Item
                            name={[field.name, 'unitPriceYuan']}
                            rules={[{ required: true }]}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber
                              aria-label={`单价${field.name + 1}`}
                              prefix="¥"
                              min={0}
                              max={1000000000}
                              precision={2}
                              formatter={formatQuoteNumberInput}
                              parser={(value) =>
                                Number(value?.replaceAll(',', '') || 0)
                              }
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        ),
                      },
                      {
                        title: '金额',
                        align: 'right',
                        width: 110,
                        render: (_, field) =>
                          formatQuoteMoney(
                            lineAmountCents(
                              form.getFieldValue(['items', field.name]) ?? {},
                            ),
                          ),
                      },
                      {
                        title: '操作',
                        width: 50,
                        render: (_, field) => (
                          <Tooltip title="删除">
                            <Button
                              type="text"
                              aria-label={`删除项目${field.name + 1}`}
                              icon={<DeleteOutlined />}
                              onClick={() => remove(field.name)}
                            />
                          </Tooltip>
                        ),
                      },
                    ]}
                  />
                )}
              </Form.Item>
              <Form.ErrorList errors={errors} />
            </>
          )}
        </Form.List>
        <AmountSummary />
        {discount > 0 && (
          <ProFormTextArea
            name="internalDiscountReason"
            label="内部优惠原因"
            placeholder="例如：竞争性报价，用于推进首次合作"
            extra="仅内部可见，不会展示给客户。"
            rules={[{ max: 500 }]}
            fieldProps={{
              maxLength: 500,
              autoSize: { minRows: 2, maxRows: 4 },
              'aria-label': '内部优惠原因',
            }}
          />
        )}
        <ProFormTextArea
          name="remark"
          label="备注"
          placeholder="请输入报价说明或交付边界等信息"
          fieldProps={{
            maxLength: 2000,
            showCount: true,
            autoSize: { minRows: 3, maxRows: 5 },
          }}
        />
      </ModalForm>
    </>
  );
}
