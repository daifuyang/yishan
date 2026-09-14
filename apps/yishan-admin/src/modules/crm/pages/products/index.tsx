import type { ProColumns } from '@ant-design/pro-components';
import React from 'react';
import { listProducts, type ProductRow } from '@/services/crm';
import { CrmEntityList, formatMoney } from '../_shared/CrmEntityList';

const columns: ProColumns<ProductRow>[] = [
  { title: '编码', dataIndex: 'code' },
  { title: '产品/服务', dataIndex: 'name' },
  { title: '分类', dataIndex: 'categoryName' },
  { title: '单位', dataIndex: 'unitName', search: false },
  { title: '标准价', dataIndex: 'standardPriceCents', search: false, render: (_, row) => formatMoney(row.standardPriceCents) },
  { title: '状态', dataIndex: 'enabled', valueEnum: { 0: { text: '停用', status: 'Default' }, 1: { text: '启用', status: 'Success' } } },
];
export default function ProductsPage() {
  return <CrmEntityList title="产品服务" columns={columns} load={listProducts} fields={columns.filter((column) => typeof column.dataIndex === 'string').map((column) => ({ key: column.dataIndex as keyof ProductRow, label: String(column.title) }))} />;
}
