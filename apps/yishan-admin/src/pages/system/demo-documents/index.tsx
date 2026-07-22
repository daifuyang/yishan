/**
 * /system/demo-documents — 模块演示列表页。
 *
 * 演示：菜单（来自 demo/module.json adminMenu）→ 路由守卫 → 模块 API → DB → ProTable。
 * 现阶段 demo 的 routes 未接入 @fastify/swagger，因此没有 generated service，
 * 这里直接用 `request('/api/demo/v1/documents')` 调模块 API。
 *
 * 后续若把 demo 接入 swagger 并重生 openapi.json，可把下方 request() 调用替换成
 * `@/services/generated/demoDocuments` 的导出，页面结构无需改动。
 */
import {
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { request } from '@umijs/max';
import React from 'react';

interface DemoDocument {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface DemoDocumentsResp {
  total: number;
  items: DemoDocument[];
}

const DemoDocumentsList: React.FC = () => {
  const columns: ProColumns<DemoDocument>[] = [
    { title: 'ID', dataIndex: 'id', search: false, width: 80 },
    { title: '标题', dataIndex: 'title', width: 200 },
    { title: '内容', dataIndex: 'content', search: false, ellipsis: true },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      search: false,
      valueType: 'dateTime',
      width: 180,
    },
  ];

  return (
    <PageContainer>
      <ProTable<DemoDocument>
        headerTitle="模块演示 · 文档列表"
        rowKey="id"
        search={false}
        request={async () => {
          const result = await request<DemoDocumentsResp>(
            '/api/demo/v1/documents',
          );
          return {
            data: result.items || [],
            success: true,
            total: result.total || 0,
          };
        }}
        columns={columns}
        scroll={{ x: 800 }}
      />
    </PageContainer>
  );
};

export default DemoDocumentsList;
