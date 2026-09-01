/**
 * CRM 客户详情页。
 *
 * Tabs：概览 / 联系人 / 跟进记录 / 流转记录
 * Header：客户名称、标签、状态；右侧：写跟进、编辑、更多。
 */

import {
  DrawerForm,
  PageContainer,
  ProFormDateTimePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components'
import { Button, Descriptions, message, Modal, Popconfirm, Space, Tag, Timeline } from 'antd'
import React, { useEffect, useState } from 'react'
import { history, useLocation } from '@umijs/max'
import {
  claimCustomer,
  createActivity,
  createContactForCustomer,
  deleteContact,
  deleteCustomer,
  getCustomer,
  listActivitiesByCustomer,
  listContactsByCustomer,
  listTransfers,
  releaseCustomer,
  transferCustomer,
  updateContact,
  updateCustomer,
  type ActivityCreateInput,
  type ActivityRow,
  type ContactCreateInput,
  type ContactRow,
  type CustomerDetail,
  type TransferLogRow,
} from '@/services/crm'

const ACTIVITY_OPTIONS = [
  { value: 'phone', label: '电话' },
  { value: 'wechat', label: '微信' },
  { value: 'visit', label: '拜访' },
  { value: 'meeting', label: '会议' },
  { value: 'email', label: '邮件' },
  { value: 'other', label: '其他' },
]

function useQueryParam(name: string): string | undefined {
  const location = useLocation()
  const search = new URLSearchParams(location.search)
  return search.get(name) ?? undefined
}

const CustomerDetailPage: React.FC = () => {
  const idStr = useQueryParam('id')
  const id = idStr ? Number(idStr) : 0
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [transfers, setTransfers] = useState<TransferLogRow[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactRow | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [c, ct, ac, tr] = await Promise.all([
        getCustomer(id),
        listContactsByCustomer(id),
        listActivitiesByCustomer(id),
        listTransfers(id),
      ])
      setCustomer(c)
      setContacts(ct)
      setActivities(ac.items ?? [])
      setTransfers(tr)
    } catch (err: any) {
      message.error(err?.message ?? '加载客户详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!id) {
    return (
      <PageContainer>
        <div>请指定客户 ID（如 /crm/customer-detail?id=1）</div>
      </PageContainer>
    )
  }

  if (!customer) {
    return (
      <PageContainer loading={loading}>
        <div>{loading ? '加载中…' : '客户不存在或已删除'}</div>
      </PageContainer>
    )
  }

  const handleEdit = async (values: any) => {
    await updateCustomer(id, values)
    message.success('已更新')
    setEditOpen(false)
    load()
  }

  const handleClaim = async () => {
    await claimCustomer(id)
    message.success('已认领')
    load()
  }

  const handleRelease = async () => {
    const reason = window.prompt('释放原因（可选）')
    if (reason === null) return
    await releaseCustomer(id, reason || undefined)
    message.success('已释放到公海')
    load()
  }

  const handleTransfer = async () => {
    const input = window.prompt('目标用户 ID')
    if (!input) return
    const targetUserId = Number(input)
    if (!targetUserId || Number.isNaN(targetUserId)) {
      message.error('目标用户 ID 不合法')
      return
    }
    const reason = window.prompt('转交原因（可选）') ?? undefined
    await transferCustomer(id, targetUserId, reason)
    message.success('已转交')
    load()
  }

  const handleDelete = async () => {
    Modal.confirm({
      title: `确认删除「${customer.name}」？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await deleteCustomer(id)
        message.success('已删除')
        history.push('/crm/customers')
      },
    })
  }

  const handleWriteActivity = async (values: ActivityCreateInput) => {
    await createActivity(id, values)
    message.success('跟进已记录')
    setActivityOpen(false)
    load()
  }

  const handleCreateContact = async (values: Record<string, unknown>) => {
    await createContactForCustomer(id, values as Omit<ContactCreateInput, 'customerId'>)
    message.success('联系人已添加')
    setContactOpen(false)
    setEditingContact(null)
    load()
  }

  const handleUpdateContact = async (values: Partial<ContactCreateInput>) => {
    if (!editingContact) return
    await updateContact(editingContact.id, values)
    message.success('联系人已更新')
    setContactOpen(false)
    setEditingContact(null)
    load()
  }

  const handleDeleteContact = async (contactId: number) => {
    await deleteContact(contactId)
    message.success('联系人已删除')
    load()
  }

  return (
    <PageContainer
      header={{
        title: customer.name,
        subTitle: (
          <Space>
            {customer.poolStatus === 'public' ? (
              <Tag color="default">公海</Tag>
            ) : (
              <Tag color="blue">已分配</Tag>
            )}
            {customer.statusName && <Tag>{customer.statusName}</Tag>}
            {customer.level && <Tag color="purple">{customer.level}</Tag>}
          </Space>
        ),
        breadcrumb: {},
      }}
      extra={[
        <Button key="activity" type="primary" onClick={() => setActivityOpen(true)}>
          写跟进
        </Button>,
        <Button key="edit" onClick={() => setEditOpen(true)}>
          编辑
        </Button>,
        customer.poolStatus === 'public' ? (
          <Button key="claim" type="primary" onClick={handleClaim}>
            认领
          </Button>
        ) : null,
        customer.poolStatus === 'owned' ? (
          <>
            <Button key="release" onClick={handleRelease}>
              释放
            </Button>
            <Button key="transfer" onClick={handleTransfer}>
              转交
            </Button>
          </>
        ) : null,
        <Button key="delete" danger onClick={handleDelete}>
          删除
        </Button>,
      ].filter(Boolean)}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        {/* 左侧：最近跟进时间线 */}
        <div style={{ flex: 2, background: '#fff', padding: 16, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>最近跟进</h3>
          {activities.length === 0 ? (
            <div style={{ color: '#999' }}>暂无跟进记录</div>
          ) : (
            <Timeline
              items={activities.slice(0, 10).map((a) => ({
                children: (
                  <div>
                    <div>
                      <Tag color="blue">{a.type}</Tag>
                      <strong>{a.operatorUserName ?? `用户${a.operatorUserId}`}</strong>
                      <span style={{ color: '#999', marginLeft: 8 }}>
                        {new Date(a.occurredAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ marginTop: 4 }}>{a.content}</div>
                    {a.nextFollowUpAt && (
                      <div style={{ marginTop: 4, color: '#1890ff' }}>
                        下次跟进：{new Date(a.nextFollowUpAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          )}
        </div>

        {/* 右侧：客户信息摘要 */}
        <div style={{ flex: 1, background: '#fff', padding: 16, borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>客户信息</h3>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="负责人">
              {customer.ownerUserName ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="主要联系人">
              {customer.primaryContactName ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">
              {customer.phone ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="最近跟进">
              {customer.lastFollowUpAt
                ? new Date(customer.lastFollowUpAt).toLocaleString()
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="下次跟进">
              {customer.nextFollowUpAt
                ? new Date(customer.nextFollowUpAt).toLocaleString()
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="标签">
              {customer.tagIds.length > 0
                ? customer.tagIds.map((id) => (
                    <Tag key={id} color="cyan">
                      #{id}
                    </Tag>
                  ))
                : '—'}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </div>

      {/* 联系人 Tab */}
      <div style={{ marginTop: 16, background: '#fff', padding: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>联系人</h3>
          <Button type="primary" onClick={() => { setEditingContact(null); setContactOpen(true) }}>
            新建联系人
          </Button>
        </div>
        {contacts.length === 0 ? (
          <div style={{ color: '#999', marginTop: 12 }}>暂无联系人</div>
        ) : (
          <table style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>姓名</th>
                <th style={{ padding: 8 }}>性别</th>
                <th style={{ padding: 8 }}>手机</th>
                <th style={{ padding: 8 }}>邮箱</th>
                <th style={{ padding: 8 }}>部门 / 职位</th>
                <th style={{ padding: 8 }}>主联系人</th>
                <th style={{ padding: 8 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 8 }}>{c.name}</td>
                  <td style={{ padding: 8 }}>{c.gender === 1 ? '男' : c.gender === 2 ? '女' : '—'}</td>
                  <td style={{ padding: 8 }}>{c.mobile ?? '—'}</td>
                  <td style={{ padding: 8 }}>{c.email ?? '—'}</td>
                  <td style={{ padding: 8 }}>
                    {c.department ?? '—'} / {c.position ?? '—'}
                  </td>
                  <td style={{ padding: 8 }}>{c.isPrimary === 1 ? <Tag color="blue">主联系人</Tag> : '—'}</td>
                  <td style={{ padding: 8 }}>
                    <Space size={12}>
                      <a onClick={() => { setEditingContact(c); setContactOpen(true) }}>编辑</a>
                      <Popconfirm
                        title={`确认删除「${c.name}」？`}
                        okText="删除"
                        cancelText="取消"
                        onConfirm={() => handleDeleteContact(c.id)}
                      >
                        <a style={{ color: '#ff4d4f' }}>删除</a>
                      </Popconfirm>
                    </Space>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 跟进记录 */}
      <div style={{ marginTop: 16, background: '#fff', padding: 16, borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>跟进记录</h3>
          <Button type="primary" onClick={() => setActivityOpen(true)}>
            写跟进
          </Button>
        </div>
        {activities.length === 0 ? (
          <div style={{ color: '#999', marginTop: 12 }}>暂无跟进记录</div>
        ) : (
          <Timeline
            style={{ marginTop: 12 }}
            items={activities.map((a) => ({
              children: (
                <div>
                  <div>
                    <Tag color="blue">{a.type}</Tag>
                    <strong>{a.operatorUserName ?? `用户${a.operatorUserId}`}</strong>
                    <span style={{ color: '#999', marginLeft: 8 }}>
                      {new Date(a.occurredAt).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ marginTop: 4 }}>{a.content}</div>
                  {a.nextFollowUpAt && (
                    <div style={{ marginTop: 4, color: '#1890ff' }}>
                      下次跟进：{new Date(a.nextFollowUpAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        )}
      </div>

      {/* 流转记录 */}
      <div style={{ marginTop: 16, background: '#fff', padding: 16, borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>流转记录</h3>
        {transfers.length === 0 ? (
          <div style={{ color: '#999' }}>暂无流转记录</div>
        ) : (
          <Timeline
            items={transfers.map((t) => {
              const typeLabel: Record<string, string> = {
                assign: '分配',
                transfer: '转交',
                claim: '认领',
                release: '释放',
              }
              return {
                children: (
                  <div>
                    <div>
                      <Tag color="purple">{typeLabel[t.type] ?? t.type}</Tag>
                      <span style={{ color: '#999' }}>
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      {t.type === 'claim' && t.toUserName && (
                        <>{t.operatorUserName ?? '系统'} 认领了该客户</>
                      )}
                      {t.type === 'release' && t.fromUserName && (
                        <>{t.fromUserName} 释放了该客户</>
                      )}
                      {t.type === 'transfer' && t.fromUserName && t.toUserName && (
                        <>{t.fromUserName} → {t.toUserName}（操作人：{t.operatorUserName ?? '—'}）</>
                      )}
                      {t.reason && (
                        <span style={{ color: '#666', marginLeft: 8 }}>原因：{t.reason}</span>
                      )}
                    </div>
                  </div>
                ),
              }
            })}
          />
        )}
      </div>

      {/* 写跟进 Drawer */}
      <DrawerForm
        title="写跟进"
        open={activityOpen}
        onOpenChange={(open) => setActivityOpen(open)}
        onFinish={async (values: ActivityCreateInput) => {
          await handleWriteActivity(values)
          return true
        }}
        drawerProps={{ destroyOnClose: true, width: 520 }}
        initialValues={{ type: 'phone' }}
      >
        <ProFormSelect
          name="type"
          label="跟进方式"
          options={ACTIVITY_OPTIONS}
          rules={[{ required: true }]}
        />
        <ProFormSelect
          name="contactId"
          label="联系人"
          options={contacts.map((c) => ({ value: c.id, label: c.name }))}
          fieldProps={{ allowClear: true }}
        />
        <ProFormTextArea
          name="content"
          label="跟进内容"
          rules={[{ required: true, max: 2000 }]}
          fieldProps={{ rows: 4, showCount: true }}
        />
        <ProFormDateTimePicker
          name="nextFollowUpAt"
          label="下次跟进时间"
          fieldProps={{ style: { width: '100%' } }}
        />
      </DrawerForm>

      {/* 新建/编辑联系人 Drawer */}
      <DrawerForm
        title={editingContact ? `编辑联系人「${editingContact.name}」` : '新建联系人'}
        open={contactOpen}
        onOpenChange={(open) => {
          setContactOpen(open)
          if (!open) setEditingContact(null)
        }}
        onFinish={async (values) => {
          if (editingContact) {
            await handleUpdateContact(values)
          } else {
            await handleCreateContact(values)
          }
          return true
        }}
        initialValues={
          editingContact
            ? {
                name: editingContact.name,
                gender: editingContact.gender,
                mobile: editingContact.mobile ?? undefined,
                phone: editingContact.phone ?? undefined,
                email: editingContact.email ?? undefined,
                department: editingContact.department ?? undefined,
                position: editingContact.position ?? undefined,
                isPrimary: editingContact.isPrimary,
              }
            : { gender: 0, isPrimary: 0 }
        }
        drawerProps={{ destroyOnClose: true, width: 520 }}
      >
        <ProFormText name="name" label="姓名" rules={[{ required: true, max: 100 }]} />
        <ProFormSelect
          name="gender"
          label="性别"
          options={[
            { value: 0, label: '未知' },
            { value: 1, label: '男' },
            { value: 2, label: '女' },
          ]}
        />
        <ProFormText name="mobile" label="手机" rules={[{ max: 32 }]} />
        <ProFormText name="phone" label="电话" rules={[{ max: 32 }]} />
        <ProFormText name="email" label="邮箱" />
        <ProFormText name="department" label="部门" />
        <ProFormText name="position" label="职位" />
        <ProFormSelect
          name="isPrimary"
          label="是否主联系人"
          options={[
            { value: 0, label: '否' },
            { value: 1, label: '是' },
          ]}
        />
      </DrawerForm>

      {/* 编辑客户 Drawer */}
      <DrawerForm
        title={`编辑客户「${customer.name}」`}
        open={editOpen}
        onOpenChange={(open) => setEditOpen(open)}
        onFinish={async (values) => {
          await handleEdit(values)
          return true
        }}
        initialValues={{
          name: customer.name,
          type: customer.type,
          statusId: customer.statusId ?? undefined,
          sourceId: customer.sourceId ?? undefined,
          level: customer.level ?? undefined,
          industry: customer.industry ?? undefined,
          phone: customer.phone ?? undefined,
          website: customer.website ?? undefined,
          province: customer.province ?? undefined,
          city: customer.city ?? undefined,
          address: customer.address ?? undefined,
          remark: customer.remark ?? undefined,
        }}
        drawerProps={{ destroyOnClose: true, width: 720 }}
      >
        <ProFormText name="name" label="客户名称" rules={[{ required: true, max: 200 }]} />
        <ProFormSelect
          name="type"
          label="客户类型"
          options={[
            { value: 'enterprise', label: '企业客户' },
            { value: 'individual', label: '个人客户' },
          ]}
        />
        <ProFormText name="phone" label="联系电话" />
        <ProFormText name="industry" label="行业" />
        <ProFormText name="level" label="客户等级" />
        <ProFormText name="website" label="官网" />
        <ProFormText name="province" label="省份" />
        <ProFormText name="city" label="城市" />
        <ProFormText name="address" label="详细地址" />
        <ProFormTextArea name="remark" label="备注" fieldProps={{ rows: 3 }} />
      </DrawerForm>
    </PageContainer>
  )
}

export default CustomerDetailPage
