import { PlusOutlined } from '@ant-design/icons'
import {
  type ActionType,
  DrawerForm,
  ModalForm,
  PageContainer,
  ProFormDigit,
  ProFormRadio,
  ProFormText,
  ProTable,
  type ProColumns,
} from '@ant-design/pro-components'
import { Button, message, Popconfirm, Space, Tag } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import {
  deleteShopV1AttributesId,
  getShopV1Attributes,
  getShopV1AttributesIdValues,
  patchShopV1AttributesId,
  postShopV1Attributes,
  postShopV1AttributesIdValues,
} from '@/services/generated/shop'

type Status = 0 | 1
type AttributeType = 1 | 2 | 3
interface Attribute { id: number; name: string; type: number; sortOrder: number; status: number; createdAt: string }
interface AttributeValue { id: number; attributeId: number; value: string; sortOrder: number; status: number }
interface ListResp { total: number; items: Attribute[] }
interface FormValues { name: string; sortOrder?: number; status?: Status }
interface ValueFormValues { value: string; sortOrder?: number }

const statusText: Record<Status, string> = { 0: '禁用', 1: '启用' }
const typeText: Record<AttributeType, string> = { 1: '文本', 2: '图片', 3: '颜色' }

const Attributes: React.FC = () => {
  const actionRef = useRef<ActionType>(null)
  const [editing, setEditing] = useState<Attribute | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [valuesDrawer, setValuesDrawer] = useState<Attribute | null>(null)
  const [values, setValues] = useState<AttributeValue[]>([])
  const [valuesLoading, setValuesLoading] = useState(false)

  const fetchList = async (params: Record<string, any>) => {
    const res = await getShopV1Attributes({ page: params.current ?? 1, pageSize: params.pageSize ?? 10, keyword: params.name, status: params.status }, {})
    const data = res as unknown as ListResp
    return { data: data?.items ?? [], success: true, total: data?.total ?? 0 }
  }
  const reload = () => actionRef.current?.reload()
  const handleDelete = async (id: number) => { await deleteShopV1AttributesId({ id }, {}); message.success('已删除'); reload() }
  const loadValues = async (id: number) => { setValuesLoading(true); try { const res = await getShopV1AttributesIdValues({ id }, {}); setValues((res as unknown as AttributeValue[]) ?? []) } finally { setValuesLoading(false) } }
  useEffect(() => { if (valuesDrawer) loadValues(valuesDrawer.id); else setValues([]) }, [valuesDrawer])
  const handleAddValue = async (v: ValueFormValues) => { if (!valuesDrawer) return false; await postShopV1AttributesIdValues({ id: valuesDrawer.id }, { value: v.value.trim(), sortOrder: v.sortOrder ?? 0, status: 1 }, {}); message.success('已添加'); await loadValues(valuesDrawer.id); return true }
  const columns: ProColumns<Attribute>[] = [
    { title: 'ID', dataIndex: 'id', width: 64, search: false },
    { title: '属性名称', dataIndex: 'name', width: 160 },
    { title: '类型', dataIndex: 'type', width: 80, search: false, render: (_, r) => typeText[r.type as AttributeType] ?? '-' },
    { title: '排序', dataIndex: 'sortOrder', width: 64, search: false },
    { title: '状态', dataIndex: 'status', width: 80, valueEnum: { 0: '禁用', 1: '启用' }, render: (_, r) => <Tag color={r.status === 1 ? 'success' : 'default'}>{statusText[r.status as Status]}</Tag> },
    { title: '创建时间', dataIndex: 'createdAt', width: 160, search: false, valueType: 'dateTime' },
    { title: '操作', valueType: 'option', width: 160, fixed: 'right', render: (_, r) => <Space><a onClick={() => setEditing(r)}>编辑</a><a onClick={() => setValuesDrawer(r)}>管理值</a><Popconfirm title="确定删除该属性？" onConfirm={() => handleDelete(r.id)}><a>删除</a></Popconfirm></Space> },
  ]
  const valueColumns: ProColumns<AttributeValue>[] = [
    { title: 'ID', dataIndex: 'id', width: 64 }, { title: '值', dataIndex: 'value', width: 160 }, { title: '排序', dataIndex: 'sortOrder', width: 64 },
    { title: '状态', dataIndex: 'status', width: 80, valueEnum: { 0: '禁用', 1: '启用' } },
    { title: '操作', valueType: 'option', render: (_, _v) => <Space><a>编辑</a><Popconfirm title="确定删除该属性值？"><a>删除</a></Popconfirm></Space> },
  ]
  const save = async (v: FormValues) => { if (editing) await patchShopV1AttributesId({ id: editing.id }, { name: v.name, sortOrder: v.sortOrder, status: v.status }, {}); else await postShopV1Attributes({ name: v.name, type: 1, sortOrder: v.sortOrder ?? 0, status: v.status ?? 1 }, {}); message.success('保存成功'); setEditing(null); setCreateOpen(false); reload(); return true }
  return <PageContainer><ProTable<Attribute> headerTitle="属性列表" rowKey="id" actionRef={actionRef} columns={columns} request={fetchList} search={{ defaultCollapsed: true }} scroll={{ x: 900 }} toolBarRender={() => [<Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建属性</Button>]} /><ModalForm<FormValues> title={editing ? '编辑属性' : '新建属性'} open={createOpen || !!editing} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditing(null) } }} onFinish={save} width={640} layout="horizontal" labelCol={{ span: 4 }} initialValues={editing ?? { sortOrder: 0, status: 1 }}><ProFormText name="name" label="属性名称" rules={[{ required: true }]} /><ProFormDigit name="sortOrder" label="排序" min={0} /><ProFormRadio.Group name="status" label="状态" options={[{ label: '启用', value: 1 }, { label: '禁用', value: 0 }]} /></ModalForm><DrawerForm<ValueFormValues> title={valuesDrawer ? `属性值管理：${valuesDrawer.name}` : '属性值管理'} open={!!valuesDrawer} onOpenChange={(o) => !o && setValuesDrawer(null)} onFinish={handleAddValue} submitter={{ searchConfig: { submitText: '添加' } }} drawerProps={{ destroyOnClose: true, width: 720 }}><ProFormText name="value" label="值" rules={[{ required: true }]} /><ProFormDigit name="sortOrder" label="排序" initialValue={0} min={0} /><ProTable<AttributeValue> rowKey="id" columns={valueColumns} dataSource={values} loading={valuesLoading} search={false} options={false} pagination={false} /></DrawerForm></PageContainer>
}
export default Attributes
