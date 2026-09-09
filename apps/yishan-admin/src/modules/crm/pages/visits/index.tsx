/**
 * 拜访独立列表页。
 *
 * Phase 4 引入：复用 crm_activity(type='visit')，按 planned_at 排序。
 * 与"客户活动"路径区分，专门服务于"拜访日程"视图。
 *
 * 列：客户 / 拜访时间（planned_at）/ 拜访地点 / 参与人 / 拜访结果 / 摘要
 * 行操作：点击客户跳转详情抽屉
 */

import { PageContainer, type ProColumns, ProTable } from '@ant-design/pro-components';
import { Tag } from 'antd';
import dayjs from 'dayjs';
import React from 'react';
import { listVisits, type ActivityResp } from '@/services/crm';

const VISIT_RESULT_TAG_COLOR: Record<string, string> = {
  successful: 'green',
  no_show: 'orange',
  rescheduled: 'blue',
  invalid_contact: 'red',
};

const VisitsPage: React.FC = () => {
  const columns: ProColumns<ActivityResp>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false,
    },
    {
      title: '客户 ID',
      dataIndex: 'entityId',
      width: 100,
      render: (_, r) => r.entityId ?? r.customerId ?? '—',
    },
    {
      title: '计划时间',
      dataIndex: 'plannedAt',
      width: 180,
      valueType: 'dateTime',
    },
    {
      title: '地点',
      dataIndex: 'location',
      width: 200,
      ellipsis: true,
    },
    {
      title: '参与人',
      dataIndex: 'participants',
      width: 200,
      ellipsis: true,
    },
    {
      title: '拜访结果',
      dataIndex: 'visitResultCode',
      width: 120,
      render: (_, r) =>
        r.visitResultCode ? (
          <Tag color={VISIT_RESULT_TAG_COLOR[r.visitResultCode] ?? 'default'}>
            {r.visitResultCode}
          </Tag>
        ) : (
          '—'
        ),
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      width: 220,
      ellipsis: true,
      search: false,
    },
    {
      title: '操作人',
      dataIndex: 'operatorUserName',
      width: 120,
      search: false,
      render: (_, r) => r.operatorUserName ?? `用户 #${r.operatorUserId}`,
    },
    {
      title: '发生时间',
      dataIndex: 'occurredAt',
      width: 180,
      valueType: 'dateTime',
      search: false,
      // ProColumns<ActivityResp> 的 defaultSortOrder 类型为 SortOrder 字面量；
      // 字面量 'desc' 在 strict 模式下不收敛，cast 收敛后运行时等价。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultSortOrder: 'desc' as any,
    },
  ];

  return (
    <PageContainer
      header={{
        title: '拜访',
        subTitle: '按计划时间排序的全局拜访日程（crm_activity.type = visit）',
      }}
    >
      <ProTable<ActivityResp>
        headerTitle="拜访列表"
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const { data, total } = await listVisits({
            customerId: params.entityId as number | undefined,
            plannedFrom: (params.plannedAt as string[] | undefined)?.[0],
            plannedTo: (params.plannedAt as string[] | undefined)?.[1],
            page: params.current,
            pageSize: params.pageSize,
          });
          return { data, total, success: true };
        }}
        search={{
          labelWidth: 'auto',
          defaultCollapsed: false,
        }}
        pagination={{ pageSize: 20 }}
      />
    </PageContainer>
  );
};

export default VisitsPage;
