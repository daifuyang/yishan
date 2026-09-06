import {
  ModalForm,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { Alert, Form, message, Spin, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  convertLead,
  getLeadConversionPreview,
  type LeadConversionPreview,
  type LeadConvertInput,
  type LeadRow,
} from '@/services/crm';

interface ConvertLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadRow | null;
  onConverted?: (result: { lead: LeadRow; customerId: number; contactId: number }) => void;
}

type CustomerMode = 'existing' | 'create';
type ContactMode = 'existing' | 'create';

/**
 * 转为客户弹窗。
 *
 * 流程：
 *   1. 打开时拉取 /conversion-preview（要求 lead.status='qualified'）。
 *   2. 用户在「客户 / 联系人」各选一个明确 decision：
 *      - 客户：现有候选 or 新建（含 enterprise/individual 切换）
 *      - 联系人：现有（必须属于所选客户）or 新建主联系人
 *   3. 提交时调用 /convert，成功后弹出"已转为客户"，把 lead / customerId / contactId 抛给外层。
 *   4. 后端返回 CRM_LEAD_CONVERSION_CONFLICT 时，弹窗不关闭，重新拉 preview 让用户看到最新状态。
 */
export default function ConvertLeadDialog({
  open,
  onOpenChange,
  lead,
  onConverted,
}: ConvertLeadDialogProps) {
  const [preview, setPreview] = useState<LeadConversionPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form] = Form.useForm()
  const customerMode = Form.useWatch('customerMode', form) as CustomerMode | undefined
  const contactMode = Form.useWatch('contactMode', form) as ContactMode | undefined
  const customerId = Form.useWatch('customerId', form) as number | undefined

  useEffect(() => {
    if (!open || !lead) return
    const currentLead = lead
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    setPreview(null)
    getLeadConversionPreview(currentLead.id)
      .then((p) => {
        if (cancelled) return
        setPreview(p)
        const defaultCustomerMode: CustomerMode = p.customers.length > 0 ? 'existing' : 'create'
        const defaultCustomerId = p.customers[0]?.id
        const defaultContactMode: ContactMode = 'create'
        form.setFieldsValue({
          customerMode: defaultCustomerMode,
          customerId: defaultCustomerId,
          customerType: 'enterprise',
          contactMode: defaultContactMode,
        })
      })
      .catch((err: any) => {
        if (cancelled) return
        setLoadError(err?.message ?? '加载预览失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, lead, form])

  const contactsForCustomer = useMemo(() => {
    if (!preview) return []
    if (customerMode !== 'existing' || !customerId) return []
    return preview.contacts.filter((c) => c.customerId === customerId)
  }, [preview, customerMode, customerId])

  const customerOptions = useMemo(() => {
    if (!preview) return []
    return preview.customers.map((c) => ({
      value: c.id,
      label: `${c.name}${c.ownerUserName ? ` · 负责人 ${c.ownerUserName}` : ' · 公海'}`,
    }))
  }, [preview])

  return (
    <ModalForm
      open={open}
      onOpenChange={onOpenChange}
      title="转为客户"
      width={640}
      modalProps={{ destroyOnHidden: true, okButtonProps: { loading: submitting } }}
      form={form}
      onFinish={async (values) => {
        const currentLead = lead
        if (!currentLead) return false
        const input: LeadConvertInput = {
          customer: buildCustomerInput(values),
          contact: buildContactInput(values, contactsForCustomer, currentLead),
        }
        setSubmitting(true)
        try {
          const result = await convertLead(currentLead.id, input)
          message.success('已转为客户')
          onConverted?.({
            lead: result.lead,
            customerId: result.customer.id,
            contactId: result.contact.id,
          })
          return true
        } catch (err: any) {
          // 转化冲突（已被其他人转走）→ 重新拉 preview
          message.error(err?.message ?? '转化失败')
          if (err?.code === 33412) {
            setLoading(true)
            getLeadConversionPreview(currentLead.id)
              .then(setPreview)
              .catch(() => undefined)
              .finally(() => setLoading(false))
          }
          return false
        } finally {
          setSubmitting(false)
        }
      }}
    >
      {loadError ? (
        <Alert type="error" message={loadError} style={{ marginBottom: 16 }} />
      ) : null}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin />
        </div>
      ) : preview ? (
        <>
          <Alert
            type="info"
            showIcon
            message="转化表示客户与联系人已关联或创建，不代表成交。"
            style={{ marginBottom: 16 }}
          />
          <Form.Item label="客户" required>
            <Form.Item
              name="customerMode"
              noStyle
              rules={[{ required: true, message: '请选择客户处理方式' }]}
            >
              <ProFormRadio.Group
                options={[
                  {
                    value: 'existing',
                    label: `关联现有客户${preview.customers.length > 0 ? ` (${preview.customers.length})` : ''}`,
                  },
                  { value: 'create', label: '新建客户' },
                ]}
              />
            </Form.Item>
            {customerMode === 'existing' ? (
              <ProFormSelect
                name="customerId"
                placeholder="选择客户"
                options={customerOptions}
                rules={[{ required: true, message: '请选择现有客户' }]}
              />
            ) : null}
            {customerMode === 'create' ? (
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <ProFormText
                  name="customerName"
                  placeholder="客户名称"
                  initialValue={lead?.companyName ?? lead?.name ?? ''}
                  rules={[{ required: true, message: '请填写客户名称' }]}
                  width="md"
                />
                <ProFormRadio.Group
                  name="customerType"
                  initialValue="enterprise"
                  options={[
                    { value: 'enterprise', label: '企业' },
                    { value: 'individual', label: '个人' },
                  ]}
                />
              </div>
            ) : null}
          </Form.Item>
          <Form.Item label="联系人" required>
            <ProFormRadio.Group
              name="contactMode"
              initialValue="create"
              options={[
                ...(customerMode === 'existing' && contactsForCustomer.length > 0
                  ? [{ value: 'existing' as ContactMode, label: `关联现有联系人 (${contactsForCustomer.length})` }]
                  : []),
                { value: 'create' as ContactMode, label: '新建主联系人' },
              ]}
              rules={[{ required: true, message: '请选择联系人处理方式' }]}
            />
            {contactMode === 'existing' && customerMode === 'existing' ? (
              <ProFormSelect
                name="contactId"
                placeholder="选择联系人"
                options={contactsForCustomer.map((c) => ({
                  value: c.id,
                  label: `${c.name}${c.mobile ? ` · ${c.mobile}` : ''}`,
                }))}
                rules={[{ required: true, message: '请选择现有联系人' }]}
              />
            ) : null}
            {contactMode === 'create' ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                <ProFormText
                  name="contactName"
                  placeholder="联系人姓名"
                  initialValue={lead?.name ?? ''}
                  rules={[{ required: true, message: '请填写联系人姓名' }]}
                />
                <ProFormText
                  name="contactMobile"
                  placeholder="手机（默认沿用线索手机）"
                  initialValue={lead?.mobile ?? ''}
                />
                <ProFormText
                  name="contactEmail"
                  placeholder="邮箱（默认沿用线索邮箱）"
                  initialValue={lead?.email ?? ''}
                />
                <ProFormTextArea
                  name="contactRemark"
                  placeholder="备注（可选）"
                  fieldProps={{ autoSize: { minRows: 2, maxRows: 4 }, maxLength: 1000 }}
                />
              </div>
            ) : null}
          </Form.Item>
          {preview.contacts.length === 0 && customerMode === 'existing' ? (
            <Typography.Text type="secondary">
              所选客户下暂无匹配的联系人，请直接新建主联系人。
            </Typography.Text>
          ) : null}
        </>
      ) : null}
    </ModalForm>
  )
}

function buildCustomerInput(
  values: Record<string, unknown>,
):
  | { mode: 'existing'; customerId: number }
  | { mode: 'create'; name: string; type: 'enterprise' | 'individual' } {
  const mode = values.customerMode as CustomerMode | undefined
  if (mode === 'existing') {
    return {
      mode: 'existing',
      customerId: Number(values.customerId),
    }
  }
  return {
    mode: 'create',
    name: String(values.customerName ?? '').trim(),
    type: (values.customerType as 'enterprise' | 'individual' | undefined) ?? 'enterprise',
  }
}

function buildContactInput(
  values: Record<string, unknown>,
  _contactsForCustomer: Array<{ id: number; name: string; mobile: string | null; email: string | null; customerId: number }>,
  lead: LeadRow,
):
  | { mode: 'existing'; contactId: number }
  | { mode: 'create'; name: string; mobile?: string | null; email?: string | null } {
  const mode = values.contactMode as ContactMode | undefined
  if (mode === 'existing' && values.contactId) {
    return { mode: 'existing', contactId: Number(values.contactId) }
  }
  const name = String(values.contactName ?? lead.name ?? '').trim()
  const mobile = (values.contactMobile as string | undefined)?.trim() || lead.mobile || null
  const email = (values.contactEmail as string | undefined)?.trim() || lead.email || null
  return { mode: 'create', name, mobile, email }
}
