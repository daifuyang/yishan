import { CloseOutlined, DownOutlined, MoreOutlined, PrinterOutlined } from '@ant-design/icons';
import {
  Button,
  Divider,
  Drawer,
  Dropdown,
  Empty,
  Grid,
  message,
  Popconfirm,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import type { LeadRow } from '@/services/crm';
import { formatDateTime } from '@/utils/formatDate';
import LeadActivityRail from './LeadActivityRail';
import {
  clampLeadDrawerSize,
  getInitialLeadDrawerSize,
} from './leadDrawerSize';
import { getLeadWorkspaceLayout } from './leadWorkspaceLayout';

const statusLabels: Record<string, string> = {
  pending: '未处理',
  contact_valid: '联系方式有效',
  contact_invalid: '联系方式无效',
  closed: '关闭',
};

const valueOrDash = (value: string | number | null | undefined) => value || '—';

interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  span?: 1 | 2;
}

const DetailField = ({ label, value, span = 1 }: DetailFieldProps) => (
  <div style={{ gridColumn: span === 2 ? 'span 2' : undefined }}>
    <Typography.Text
      style={{ display: 'block', color: '#667085', fontSize: 13 }}
    >
      {label}
    </Typography.Text>
    <div
      style={{
        marginTop: 6,
        color: '#1f2937',
        fontSize: 14,
        lineHeight: '22px',
      }}
    >
      {value}
    </div>
  </div>
);

const DetailSection = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section>
    <Typography.Text strong style={{ display: 'block', fontSize: 14 }}>
      {title}
    </Typography.Text>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        columnGap: 72,
        rowGap: 22,
        marginTop: 18,
      }}
    >
      {children}
    </div>
  </section>
);

interface LeadDetailDrawerProps {
  lead: LeadRow | null;
  onClose: () => void;
  /** 公海：主操作「领取」 */
  onClaim?: (lead: LeadRow) => void;
  /** 公海：「分配给他人」 */
  onAssign?: (lead: LeadRow) => void;
  /** 私海：主操作「编辑资料」 */
  onEditLead?: (lead: LeadRow) => void;
  /** 私海：主操作「转为客户」 */
  onConvert?: (lead: LeadRow) => void;
  /** 私海已转化：「查看客户详情」 */
  onOpenCustomer?: (lead: LeadRow) => void;
  /** 私海：「转移给他人」 */
  onTransfer?: (lead: LeadRow) => void;
  /** 私海：「退回线索池」 */
  onReturnToPool?: (lead: LeadRow) => void;
  /** 公海：更多 → 打印（占位，未传则仅显示「打印」文案并 message.info） */
  onPrint?: (lead: LeadRow) => void;
  /** 公海：更多 → 删除（带 Popconfirm 二次确认） */
  onDelete?: (lead: LeadRow) => void;
  /** 当 LeadActivityRail 内部写出新 lead 时（首条跟进触发状态变更），把最新 row 抛给外层。 */
  onLeadChanged?: (next: LeadRow) => void;
}

/**
 * 线索详情抽屉。Actions 完全由 props 决定：
 *   - 公海页（lead-pool）传入 onClaim / onAssign / onEditLead / onPrint / onDelete
 *   - 私海页（leads）   传入 onConvert / onOpenCustomer / onTransfer / onReturnToPool / onEditLead
 *
 * 关闭 icon 始终渲染；不传任何 actions 时不显示右侧操作区。
 */
export default function LeadDetailDrawer({
  lead,
  onClose,
  onClaim,
  onAssign,
  onEditLead,
  onConvert,
  onOpenCustomer,
  onTransfer,
  onReturnToPool,
  onPrint,
  onDelete,
  onLeadChanged,
}: LeadDetailDrawerProps) {
  const screens = Grid.useBreakpoint();
  const [size, setSize] = useState(() =>
    getInitialLeadDrawerSize(
      typeof window === 'undefined' ? 1366 : window.innerWidth,
    ),
  );

  const renderHeaderActions = () => {
    if (!lead) return null;
    const isConverted = lead.convertedCustomerId !== null;
    // 公海「更多」菜单：打印 + 删除。
    // 私海走 onTransfer / onReturnToPool，不渲染「更多」按钮。
    const moreItems: Array<{ key: string; label: React.ReactNode; icon?: React.ReactNode }> = [];
    if (onPrint) {
      moreItems.push({
        key: 'print',
        label: '打印',
        icon: <PrinterOutlined />,
      });
    }
    if (onDelete) {
      moreItems.push({
        key: 'delete',
        label: (
          <Popconfirm
            title={
              <span>
                删除
                <strong style={{ marginLeft: 4 }}>
                  {lead.name || lead.companyName || `线索 #${lead.id}`}
                </strong>
                ？
              </span>
            }
            description="删除后线索将不可见，且无法恢复。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => onDelete(lead)}
          >
            <span style={{ color: '#d4380d' }}>删除</span>
          </Popconfirm>
        ),
      });
    }
    const handleMoreClick: import('antd').MenuProps['onClick'] = ({ key, domEvent }) => {
      if (key === 'print') {
        if (onPrint) onPrint(lead);
        else message.info('打印功能未接入');
      }
      // delete 由 Popconfirm 处理；阻止冒泡避免点两次
      if (key === 'delete') domEvent.stopPropagation();
    };

    return (
      <Space>
        {onClaim && (
          <Button type="primary" onClick={() => onClaim(lead)}>
            领取
          </Button>
        )}
        {onAssign && (
          <Button onClick={() => onAssign(lead)}>分配</Button>
        )}
        {(onConvert || (onOpenCustomer && isConverted)) && (
          <Button
            type="primary"
            onClick={() =>
              isConverted && onOpenCustomer
                ? onOpenCustomer(lead)
                : onConvert?.(lead)
            }
          >
            {isConverted ? '查看客户详情' : '转为客户'}
          </Button>
        )}
        {(onTransfer || onReturnToPool) && (
          <Dropdown
            menu={{
              items: [
                onTransfer
                  ? { key: 'transfer', label: '转移给他人' }
                  : null,
                onReturnToPool
                  ? { key: 'returnToPool', label: '退回线索池' }
                  : null,
              ].filter(Boolean) as Array<{ key: string; label: string }>,
              onClick: ({ key }) => {
                if (key === 'transfer') onTransfer?.(lead);
                else if (key === 'returnToPool') onReturnToPool?.(lead);
              },
            }}
          >
            <Button>
              转移 <DownOutlined />
            </Button>
          </Dropdown>
        )}
        {onEditLead && (
          <Button onClick={() => onEditLead(lead)}>编辑</Button>
        )}
        {moreItems.length > 0 && (
          <Dropdown
            menu={{ items: moreItems, onClick: handleMoreClick }}
            trigger={['click']}
          >
            <Button icon={<MoreOutlined />} aria-label="更多操作">
              更多
            </Button>
          </Dropdown>
        )}
        <Button
          type="text"
          icon={<CloseOutlined />}
          aria-label="关闭线索详情"
          onClick={onClose}
        />
      </Space>
    );
  };

  const renderWorkspace = () => {
    if (!lead) return null;
    const workspaceLayout = getLeadWorkspaceLayout(Boolean(screens.xl));

    // 联系信息：3 个固定字段 + 4 个条件字段（按 spec 顺序）
    const contactFields: Array<{ label: string; value: React.ReactNode }> = [
      { label: '联系人', value: valueOrDash(lead.name) },
      { label: '公司', value: valueOrDash(lead.companyName) },
      { label: '手机', value: valueOrDash(lead.mobile) },
    ];
    if (lead.email) contactFields.push({ label: '邮箱', value: lead.email });
    if (lead.wechat) contactFields.push({ label: '微信', value: lead.wechat });
    if (lead.qq) contactFields.push({ label: 'QQ', value: lead.qq });
    if (lead.phone) contactFields.push({ label: '电话', value: lead.phone });

    const ownerValue =
      lead.ownerUserId === null
        ? '线索公海'
        : lead.ownerUserName?.trim() ||
          (lead.ownerUserId ? `用户 #${lead.ownerUserId}` : '暂未分配');

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: workspaceLayout.gridTemplateColumns,
          width: workspaceLayout.width,
          minHeight: workspaceLayout.minHeight,
          height: screens.xl ? workspaceLayout.minHeight : undefined,
          alignItems: 'stretch',
        }}
      >
        <main
          style={{
            minWidth: 0,
            maxWidth: workspaceLayout.detailMaxWidth,
            paddingRight: screens.xl ? 40 : 0,
            overflowY: screens.xl ? 'auto' : undefined,
          }}
        >
          <DetailSection title="联系信息">
            {contactFields.map((field) => (
              <DetailField
                key={field.label}
                label={field.label}
                value={field.value}
              />
            ))}
          </DetailSection>
          <Divider style={{ margin: '32px 0' }} />
          <DetailSection title="业务信息">
            <DetailField label="负责人" value={ownerValue} />
            <DetailField
              label="来源"
              value={valueOrDash(lead.sourceName ?? lead.sourceId)}
            />
            <DetailField
              label="最近跟进"
              value={formatDateTime(lead.lastFollowUpAt)}
            />
            <DetailField
              label="下次跟进"
              value={formatDateTime(lead.nextFollowUpAt)}
            />
            <DetailField
              label="意向说明"
              value={valueOrDash(lead.intention)}
              span={2}
            />
          </DetailSection>
          {lead.convertedCustomerId !== null && (
            <>
              <Divider style={{ margin: '32px 0' }} />
              <DetailSection title="转化信息">
                <DetailField
                  label="客户"
                  value={
                    lead.convertedCustomerId
                      ? `客户 #${lead.convertedCustomerId}`
                      : '—'
                  }
                />
                <DetailField
                  label="联系人"
                  value={
                    lead.convertedContactId
                      ? `联系人 #${lead.convertedContactId}`
                      : '—'
                  }
                />
                <DetailField
                  label="转化时间"
                  value={formatDateTime(lead.convertedAt)}
                />
              </DetailSection>
            </>
          )}
          <Typography.Text
            type="secondary"
            style={{
              display: 'block',
              marginTop: 28,
              fontSize: 12,
              color: '#98a2b3',
            }}
          >
            创建人：
            {lead.createdByUserName?.trim() ||
              (lead.createdBy ? `用户 #${lead.createdBy}` : '—')}
            {' · 创建于 '}
            {formatDateTime(lead.createdAt)}
          </Typography.Text>
        </main>
        <div
          style={{
            minWidth: 0,
            minHeight: 0,
            overflow: 'hidden',
            borderLeft: workspaceLayout.activityBorderLeft,
            paddingLeft: workspaceLayout.activityPaddingLeft,
          }}
        >
          <LeadActivityRail lead={lead} onLeadChanged={onLeadChanged} />
        </div>
      </div>
    );
  };

  return (
    <Drawer
      open={Boolean(lead)}
      onClose={onClose}
      size={size}
      // antd ResizableConfig 没有 minSize prop；按官方文档示例在回调里
      // 用 Math.max(MIN, size) clamp。onResize 是纯通知，必须自己 setSize
      // 才能让 drawer 视觉跟随鼠标——否则只动 currentSize 内部态，wrapper
      // 视觉宽度停在 size 上，体感就是"拖不动"。
      resizable={{
        onResize: (next) => setSize(clampLeadDrawerSize(next)),
        onResizeEnd: () => undefined,
      }}
      destroyOnClose
      closable={false}
      styles={{
        header: { padding: '16px 20px' },
        body: {
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
          padding: '0 24px 24px',
        },
      }}
      title={
        lead ? (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                height: 28,
              }}
            >
              <Typography.Text
                strong
                style={{ fontSize: 18, lineHeight: '28px' }}
              >
                {lead.name || lead.companyName || `线索 #${lead.id}`}
              </Typography.Text>
              <Tag
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 24,
                  marginInlineEnd: 0,
                  lineHeight: '22px',
                }}
                color={
                  lead.status === 'contact_invalid'
                    ? 'error'
                    : lead.status === 'contact_valid'
                      ? 'success'
                      : lead.status === 'closed'
                        ? 'default'
                        : 'processing'
                }
              >
                {statusLabels[lead.status] ?? lead.status}
              </Tag>
            </div>
            <Space
              size={12}
              split={<Divider type="vertical" />}
              style={{ marginTop: 6 }}
              wrap
            >
              <Typography.Text type="secondary">
                {valueOrDash(lead.companyName)}
              </Typography.Text>
              <Typography.Text type="secondary">
                负责人：
                {lead.ownerUserId === null
                  ? '线索公海'
                  : lead.ownerUserName?.trim() || '暂未分配'}
              </Typography.Text>
              <Typography.Text type="secondary">
                最近跟进：{formatDateTime(lead.lastFollowUpAt)}
              </Typography.Text>
              <Typography.Text type="secondary">
                下次跟进：{formatDateTime(lead.nextFollowUpAt)}
              </Typography.Text>
            </Space>
          </div>
        ) : (
          '线索详情'
        )
      }
      extra={renderHeaderActions()}
    >
      <Tabs
        defaultActiveKey="basic"
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          minHeight: 0,
        }}
        styles={{
          content: { display: 'flex', flex: 1, minHeight: 0 },
        }}
        items={[
          { key: 'basic', label: '基本信息', children: renderWorkspace() },
          {
            key: 'attachments',
            label: '附件',
            children: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无附件"
              />
            ),
          },
          {
            key: 'logs',
            label: '操作日志',
            children: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无操作日志"
              />
            ),
          },
        ]}
      />
    </Drawer>
  );
}
