/**
 * 线索列表页。
 *
 * 操作列按状态展示：每个状态都有自己允许的 action 集合，由 leadActions.ts 统一管控。
 *
 * 弹窗分工：
 *   - CreateLeadDialog         新建线索
 *   - EditLeadDialog           编辑资料
 *   - TransferLeadDialog       转移负责人
 *   - QualifyLeadDialog        判为有效（受 crm:lead:qualify 控制）
 *   - DisqualifyLeadDialog     作废（受 crm:lead:disqualify 控制）
 *   - ReactivateLeadDialog     重新激活（受 crm:lead:reactivate 控制）
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
  listLeads,
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
import { getLeadActions, type LeadActionKey } from './leadActions';
import QualifyLeadDialog from './QualifyLeadDialog';
import DisqualifyLeadDialog from './DisqualifyLeadDialog';
import ReactivateLeadDialog from './ReactivateLeadDialog';
import ConvertLeadDialog from './ConvertLeadDialog';

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
  const [qualifyTarget, setQualifyTarget] = useState<LeadDetailState>(null);
  const [disqualifyTarget, setDisqualifyTarget] = useState<LeadDetailState>(null);
  const [reactivateTarget, setReactivateTarget] = useState<LeadDetailState>(null);
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
      case 'qualify':
        setQualifyTarget(openLeadDetail(record));
        return;
      case 'disqualify':
        setDisqualifyTarget(openLeadDetail(record));
        return;
      case 'reactivate':
        setReactivateTarget(openLeadDetail(record));
        return;
      case 'convert':
        setConvertTarget(openLeadDetail(record));
        return;
      case 'openCustomer':
        if (record.convertedCustomerId) {
          window.open(`/crm/customer-detail?id=${record.convertedCustomerId}`, '_self');
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
    )
    reload()
  }

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

      <QualifyLeadDialog
        open={Boolean(qualifyTarget)}
        onOpenChange={(open) => {
          if (!open) setQualifyTarget(closeLeadDetail());
        }}
        lead={qualifyTarget}
        onUpdated={applyLeadUpdate}
      />

      <DisqualifyLeadDialog
        open={Boolean(disqualifyTarget)}
        onOpenChange={(open) => {
          if (!open) setDisqualifyTarget(closeLeadDetail());
        }}
        lead={disqualifyTarget}
        onUpdated={applyLeadUpdate}
      />

      <ReactivateLeadDialog
        open={Boolean(reactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setReactivateTarget(closeLeadDetail());
        }}
        lead={reactivateTarget}
        onUpdated={applyLeadUpdate}
      />

      <ConvertLeadDialog
        open={Boolean(convertTarget)}
        onOpenChange={(open) => {
          if (!open) setConvertTarget(closeLeadDetail());
        }}
        lead={convertTarget}
        onConverted={({ lead: converted, customerId, contactId }) => {
          setDetailLead((current) =>
            current && current.id === converted.id ? converted : current,
          );
          reload();
          // 客户/联系人 ID 暂未在抽屉直接暴露，由 CRM 详情页跳转时复用。
          // 这里仅记录以便后续集成。
          if (customerId && contactId) {
            message.success('已转为客户，可在客户详情查看');
          }
        }}
      />

      <LeadDetailDrawer
        lead={detailLead}
        onClose={() => setDetailLead(closeLeadDetail())}
        onConvert={(lead) => handleActionClick('convert', lead)}
        onTransfer={(lead) => handleActionClick('transfer', lead)}
        onReturnToPool={(lead) =>
          assignLead(lead.id, null)
            .then(() => {
              message.success('线索已退回线索池');
              reload();
              setDetailLead((current) =>
                current && current.id === lead.id
                  ? { ...current, ownerUserId: null, ownerUserName: null, poolStatus: 'public' }
                  : current,
              );
            })
            .catch((err: any) => message.error(err?.message ?? '退回线索池失败'))
        }
        onEditLead={(lead) => handleActionClick('edit', lead)}
        onLeadChanged={(next) => setDetailLead(next)}
      />
    </PageContainer>
  );
}
