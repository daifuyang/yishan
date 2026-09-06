/**
 * 线索列表页。
 *
 * 操作列固定展示：查看 / 编辑 / 更多。
 * 转换、转移保留对应处理能力，但暂不在线索列表中展示。
 *
 * 「下次跟进」必须走 formatDateTime，绝不渲染 Invalid Date；过去时间打「逾期」Tag。
 *
 * 弹窗分工：
 *   - CreateLeadDialog     新建线索（mode='create'）
 *   - EditLeadDialog       编辑资料（mode='edit'）
 *   - TransferLeadDialog   转移负责人（业务动作）
 *   - LeadDetailDrawer     详情 + 转换/转移入口（drawer 内的「编辑」也会打开 EditLeadDialog）
 *
 * 真实权限校验仍在后端（crm:lead:*）。
 */

import { DownOutlined, PlusOutlined } from '@ant-design/icons';
import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import type { MenuProps } from 'antd';
import { Button, Dropdown, message, Space, Tag } from 'antd';
import { useRef, useState } from 'react';
import {
  assignLead,
  type LeadRow,
  listLeads,
  qualifyLead,
} from '@/services/crm';
import { formatDateTime, isOverdue } from '@/utils/formatDate';
import CreateLeadDialog from './CreateLeadDialog';
import EditLeadDialog from './EditLeadDialog';
import LeadDetailDrawer from './LeadDetailDrawer';
import {
  closeLeadDetail,
  openLeadDetail,
  type LeadDetailState,
} from './leadDetailState';
import TransferLeadDialog from './TransferLeadDialog';

const STATUS_VALUE_ENUM = {
  new: { text: '待处理', status: 'Default' },
  processing: { text: '跟进中', status: 'Processing' },
  qualified: { text: '有效', status: 'Success' },
  disqualified: { text: '无效', status: 'Error' },
  converted: { text: '已转化', status: 'Success' },
} as const;

export default function LeadPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeadDetailState>(null);
  const [transferTarget, setTransferTarget] = useState<LeadDetailState>(null);
  const [detailLead, setDetailLead] = useState<LeadDetailState>(null);

  const reload = () => actionRef.current?.reload();

  const renderNextFollowUp = (value: LeadRow['nextFollowUpAt']) => {
    const text = formatDateTime(value);
    if (text === '—') return <span style={{ color: '#bfbfbf' }}>—</span>;
    if (isOverdue(value)) {
      return (
        <Space size={4}>
          <span>{text}</span>
          <Tag color="red">逾期</Tag>
        </Space>
      );
    }
    return <span>{text}</span>;
  };

  const renderOwner = (record: LeadRow) => {
    return (
      <span>
        {record.ownerUserName?.trim() ||
          (record.ownerUserId ? `用户 #${record.ownerUserId}` : '—')}
      </span>
    );
  };

  /**
   * 操作列点击派发：
   *   - edit             → 打开 EditLeadDialog
   *   - transferToUser   → 打开 TransferLeadDialog
   *   - returnToPool     → 直接调 assignLead(id, null)，保留线索、走 crm:lead:assign 权限与审计。
   *   - 其余动作在接口接入前给出明确提示，而不让操作项消失。
   */
  const handleActionClick = (key: string, record: LeadRow) => {
    switch (key) {
      case 'view':
        setDetailLead(openLeadDetail(record));
        return;
      case 'edit':
        setEditTarget(openLeadDetail(record));
        return;
      case 'transferToUser':
        setTransferTarget(openLeadDetail(record));
        return;
      case 'returnToPool': {
        assignLead(record.id, null)
          .then(() => {
            message.success('线索已退回线索池');
            reload();
          })
          .catch((err: any) => message.error(err?.message ?? '退回线索池失败'));
        return;
      }
      case 'convert': {
        qualifyLead(record.id)
          .then(() => {
            message.success('线索已转换为有效线索');
            setDetailLead((current) =>
              current ? { ...current, status: 'qualified' } : current,
            );
            reload();
          })
          .catch((err: any) => message.error(err?.message ?? '转换线索失败'));
        return;
      }
      default:
        message.info('该功能暂未接入');
        return;
    }
  };

  const buildMenuItems = (
    items: { key: string; label: string; danger?: boolean }[],
    record: LeadRow,
  ): NonNullable<MenuProps['items']> =>
    items.map((item) => ({
      key: item.key,
      label: item.label,
      danger: item.danger,
      onClick: () => handleActionClick(item.key, record),
    }));

  const columns: ProColumns<LeadRow>[] = [
    {
      title: '联系人',
      dataIndex: 'name',
      width: 96,
      renderText: (v) => v || '—',
    },
    {
      title: '公司名称',
      dataIndex: 'companyName',
      width: 280,
      ellipsis: true,
      renderText: (v) => v || '—',
    },
    {
      title: '手机',
      dataIndex: 'mobile',
      width: 124,
      search: false,
      renderText: (v) => v || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      valueType: 'select',
      valueEnum: STATUS_VALUE_ENUM,
    },
    {
      title: '负责人',
      dataIndex: 'ownerUserName',
      width: 96,
      search: false,
      render: (_, record) => renderOwner(record),
    },
    {
      title: '下次跟进',
      dataIndex: 'nextFollowUpAt',
      width: 112,
      search: false,
      render: (_, record) => renderNextFollowUp(record.nextFollowUpAt),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 168,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 136,
      render: (_, record) => {
        const locked = Boolean((record as any).locked);
        const moreItems = [
          { key: 'print', label: '打印' },
          locked
            ? { key: 'unlock', label: '解锁' }
            : { key: 'lock', label: '锁定' },
          { key: 'delete', label: '删除', danger: true },
        ];
        return (
          <Space size={12} style={{ whiteSpace: 'nowrap' }}>
            <a onClick={() => handleActionClick('view', record)}>查看</a>
            <a onClick={() => handleActionClick('edit', record)}>编辑</a>
            <Dropdown
              menu={{ items: buildMenuItems(moreItems, record) }}
              trigger={['click']}
            >
              <a onClick={(event) => event.preventDefault()}>
                更多 <DownOutlined />
              </a>
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <PageContainer header={{ title: '线索' }}>
      <ProTable<LeadRow>
        rowKey="id"
        actionRef={actionRef}
        headerTitle="线索列表"
        columns={columns}
        scroll={{ x: 1100 }}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        request={async (params) => {
          const { current, pageSize, ...rest } = params as Record<
            string,
            unknown
          >;
          const result = await listLeads({
            page: (current as number) ?? 1,
            pageSize: (pageSize as number) ?? 10,
            keyword: (rest.keyword as string) ?? '',
            status: rest.status as string | undefined,
          });
          return { data: result.data, success: true, total: result.total };
        }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateOpen(true)}
          >
            新增线索
          </Button>,
        ]}
      />

      {/* 新建线索：联系人必填，负责人由服务端绑定 currentUser */}
      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={reload}
      />

      {/* 编辑线索：仅普通资料字段。Drawer 不必关闭——Modal 自然盖在 Drawer 之上；
          用户编辑时仍能透过蒙层看到线索的上下文。保存成功后同步把最新数据回填到 Drawer。 */}
      <EditLeadDialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(closeLeadDetail());
        }}
        lead={editTarget}
        onUpdated={(updated) => {
          reload();
          setDetailLead((current) =>
            current && current.id === updated.id ? updated : current,
          );
        }}
      />

      {/* 转移线索：独立业务动作，负责人变更走 Activity */}
      <TransferLeadDialog
        open={Boolean(transferTarget)}
        onOpenChange={(open) => {
          if (!open) setTransferTarget(closeLeadDetail());
        }}
        lead={transferTarget}
        onTransferred={() => {
          reload();
        }}
      />

      <LeadDetailDrawer
        lead={detailLead}
        onClose={() => setDetailLead(closeLeadDetail())}
        onConvert={(lead) => handleActionClick('convert', lead)}
        onTransfer={(lead) => handleActionClick('transferToUser', lead)}
        onReturnToPool={(lead) => handleActionClick('returnToPool', lead)}
        onEditLead={(lead) => handleActionClick('edit', lead)}
      />
    </PageContainer>
  );
}