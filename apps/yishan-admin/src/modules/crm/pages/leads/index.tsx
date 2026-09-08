/**
 * 线索列表页。
 *
 * 跟进状态与转化状态独立：所有跟进状态均可写跟进，是否已转化只由
 * convertedCustomerId 决定，由 leadActions.ts 统一管控。
 *
 * 弹窗分工：
 *   - CreateLeadDialog         新建线索
 *   - EditLeadDialog           编辑资料
 *   - TransferLeadDialog       转移负责人
 *   - ConvertLeadDialog        转为客户（受 crm:lead:convert 控制）
 *   - LeadDetailDrawer         详情 + 上述动作的入口
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
  type LeadStatus,
  listLeads,
} from '@/services/crm';
import { formatDateTime, isOverdue } from '@/utils/formatDate';
import ConvertLeadDialog from './ConvertLeadDialog';
import CreateLeadDialog from './CreateLeadDialog';
import EditLeadDialog from './EditLeadDialog';
import LeadDetailDrawer from './LeadDetailDrawer';
import { getLeadActions, type LeadActionKey } from './leadActions';
import {
  closeLeadDetail,
  type LeadDetailState,
  openLeadDetail,
} from './leadDetailState';
import TransferLeadDialog from './TransferLeadDialog';

const STATUS_VALUE_ENUM = {
  pending: { text: '未处理', status: 'Default' },
  contact_valid: { text: '联系方式有效', status: 'Success' },
  contact_invalid: { text: '联系方式无效', status: 'Error' },
  closed: { text: '关闭', status: 'Default' },
} as const;

export default function LeadPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeadDetailState>(null);
  const [transferTarget, setTransferTarget] = useState<LeadDetailState>(null);
  const [detailLead, setDetailLead] = useState<LeadDetailState>(null);
  const [convertTarget, setConvertTarget] = useState<LeadDetailState>(null);

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
   * 操作列点击派发：key 与 leadActions.ts 中定义的 LeadActionKey 完全对齐。
   */
  const handleActionClick = (key: string, record: LeadRow) => {
    switch (key as LeadActionKey) {
      case 'view':
        setDetailLead(openLeadDetail(record));
        return;
      case 'edit':
        setEditTarget(openLeadDetail(record));
        return;
      case 'followUp':
        setDetailLead(openLeadDetail(record));
        return;
      case 'transfer':
        setTransferTarget(openLeadDetail(record));
        return;
      case 'convert':
        setConvertTarget(openLeadDetail(record));
        return;
      case 'openCustomer':
        if (record.convertedCustomerId) {
          window.open(
            `/crm/customer-detail?id=${record.convertedCustomerId}`,
            '_self',
          );
        } else {
          message.info('未找到关联客户');
        }
        return;
      default:
        message.info('该功能暂未接入');
        return;
    }
  };

  // 列表行内不显示作废/重新激活/转入客户等深度操作；用"更多"承载全部 LeadAction。
  const buildRowMenu = (record: LeadRow): NonNullable<MenuProps['items']> => {
    return getLeadActions(record).map((action) => ({
      key: action.key,
      label: action.label,
      danger: action.danger,
      onClick: () => handleActionClick(action.key, record),
    }));
  };

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
      title: '线索来源',
      dataIndex: 'sourceName',
      width: 120,
      search: false,
      renderText: (v, record) =>
        (v as string | null) || (record.sourceId ? `来源 #${record.sourceId}` : '—'),
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
      width: 120,
      render: (_, record) => (
        <Space size={12} style={{ whiteSpace: 'nowrap' }}>
          <a onClick={() => handleActionClick('view', record)}>查看</a>
          <a onClick={() => handleActionClick('edit', record)}>编辑</a>
          <Dropdown menu={{ items: buildRowMenu(record) }} trigger={['click']}>
            <a onClick={(event) => event.preventDefault()}>
              更多 <DownOutlined />
            </a>
          </Dropdown>
        </Space>
      ),
    },
  ];

  // 当任何命令更新成功后，统一替换本地 lead 并刷新表格。
  const applyLeadUpdate = (updated: LeadRow) => {
    setDetailLead((current) =>
      current && current.id === updated.id ? updated : current,
    );
    reload();
  };

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
            status: rest.status as LeadStatus | undefined,
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

      <CreateLeadDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={reload}
      />

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

      <ConvertLeadDialog
        open={Boolean(convertTarget)}
        onOpenChange={(open) => {
          if (!open) setConvertTarget(closeLeadDetail());
        }}
        lead={convertTarget}
        onConverted={({ lead: converted }) => applyLeadUpdate(converted)}
      />

      <LeadDetailDrawer
        lead={detailLead}
        onClose={() => setDetailLead(closeLeadDetail())}
        onConvert={(lead) => handleActionClick('convert', lead)}
        onOpenCustomer={(lead) => handleActionClick('openCustomer', lead)}
        onTransfer={(lead) => handleActionClick('transfer', lead)}
        onReturnToPool={(lead) =>
          assignLead(lead.id, null)
            .then(() => {
              message.success('线索已退回线索池');
              reload();
              setDetailLead((current) =>
                current && current.id === lead.id
                  ? {
                      ...current,
                      ownerUserId: null,
                      ownerUserName: null,
                    }
                  : current,
              );
            })
            .catch((err: any) =>
              message.error(err?.message ?? '退回线索池失败'),
            )
        }
        onEditLead={(lead) => handleActionClick('edit', lead)}
        onLeadChanged={applyLeadUpdate}
      />
    </PageContainer>
  );
}
