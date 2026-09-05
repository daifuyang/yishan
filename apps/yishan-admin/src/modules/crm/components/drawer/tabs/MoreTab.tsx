/**
 * 客户 Drawer — More Tab。
 *
 * 左侧 5 项导航：基本信息 / 阶段历史 / 负责人团队 / 文件 / 操作日志
 * 右侧按选择渲染对应子区块。
 *
 * - 基本信息：Descriptions 1 列 bordered，全字段展开
 * - 阶段历史：复用 ActivityTimeline；当前接口不区分 stage_change，所以展示全部
 * - 负责人团队：通过 listMembers(customerId) 拉协同人列表
 * - 文件：占位
 * - 操作日志：TransferLogRow 时间线（listTransfers）
 */

import { TeamOutlined } from '@ant-design/icons';
import {
  Avatar,
  Descriptions,
  Empty,
  Layout,
  List,
  Menu,
  Skeleton,
  Timeline,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import type {
  ActivityRow,
  CustomerDetail,
  CustomerMemberRow,
  TransferLogRow,
} from '@/services/crm';
import { listMembers, listTransfers } from '@/services/crm';
import ActivityTimeline from '../sub/ActivityTimeline';

const { Sider, Content } = Layout;
const { Text } = Typography;

type SectionKey =
  | 'basic'
  | 'stage'
  | 'team'
  | 'files'
  | 'log';

const SECTIONS: Array<{ key: SectionKey; label: string }> = [
  { key: 'basic', label: '基本信息' },
  { key: 'stage', label: '阶段历史' },
  { key: 'team', label: '负责人团队' },
  { key: 'files', label: '文件' },
  { key: 'log', label: '操作日志' },
];

const TRANSFER_LABEL: Record<string, string> = {
  assign: '分配',
  transfer: '转交',
  claim: '认领',
  release: '释放',
};

export interface MoreTabProps {
  customer: CustomerDetail;
  activities: ActivityRow[];
  activitiesLoading: boolean;
}

const MoreTab: React.FC<MoreTabProps> = ({
  customer,
  activities,
  activitiesLoading,
}) => {
  const [section, setSection] = useState<SectionKey>('basic');
  const [members, setMembers] = useState<CustomerMemberRow[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [transfers, setTransfers] = useState<TransferLogRow[] | null>(null);
  const [transfersLoading, setTransfersLoading] = useState(false);

  // 切到 team 才拉协同人
  useEffect(() => {
    if (section !== 'team' || members !== null) return;
    let cancelled = false;
    setMembersLoading(true);
    listMembers(customer.id)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, customer.id, members]);

  // 切到 log 才拉流转记录
  useEffect(() => {
    if (section !== 'log' || transfers !== null) return;
    let cancelled = false;
    setTransfersLoading(true);
    listTransfers(customer.id)
      .then((rows) => {
        if (!cancelled) setTransfers(rows);
      })
      .catch(() => {
        if (!cancelled) setTransfers([]);
      })
      .finally(() => {
        if (!cancelled) setTransfersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section, customer.id, transfers]);

  return (
    <Layout
      style={{
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #f0f0f0',
        minHeight: 480,
      }}
    >
      <Sider width={180} style={{ background: '#fafafa' }}>
        <Menu
          mode="inline"
          selectedKeys={[section]}
          style={{ background: 'transparent', borderInlineEnd: 0 }}
          items={SECTIONS.map((s) => ({ key: s.key, label: s.label }))}
          onClick={(e) => setSection(e.key as SectionKey)}
        />
      </Sider>
      <Content style={{ padding: 16 }}>
        {section === 'basic' && <BasicSection customer={customer} />}
        {section === 'stage' && (
          <ActivityTimeline
            items={activities}
            loading={activitiesLoading}
            groupByDate
            emptyText="暂无阶段历史（将随阶段变更自动记录）"
          />
        )}
        {section === 'team' && (
          <TeamSection
            members={members}
            loading={membersLoading}
            ownerName={customer.ownerUserName}
          />
        )}
        {section === 'files' && <FilesPlaceholder />}
        {section === 'log' && (
          <LogSection
            transfers={transfers}
            loading={transfersLoading}
          />
        )}
      </Content>
    </Layout>
  );
};

const BasicSection: React.FC<{ customer: CustomerDetail }> = ({
  customer,
}) => {
  return (
    <Descriptions
      title="基本信息"
      column={1}
      bordered
      size="small"
      labelStyle={{ width: 120, color: '#595959' }}
    >
      <Descriptions.Item label="客户名称">{customer.name}</Descriptions.Item>
      <Descriptions.Item label="客户类型">
        {customer.type === 'enterprise'
          ? '企业'
          : customer.type === 'individual'
            ? '个人'
            : customer.type || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="客户编号">
        {customer.code || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="客户状态">
        {customer.statusName || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="客户等级">
        {customer.level || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="所属行业">
        {customer.industry || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="客户来源">
        {customer.sourceName || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="联系电话">
        {customer.phone || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="官网">
        {customer.website || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="所在地区">
        {[customer.province, customer.city].filter(Boolean).join(' / ') || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="详细地址">
        {customer.address || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="主要联系人">
        {customer.primaryContactName || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="标签">
        {customer.tagIds.length > 0
          ? customer.tagIds.map((id) => (
              <Text key={id} type="secondary" style={{ marginRight: 8 }}>
                #{id}
              </Text>
            ))
          : '—'}
      </Descriptions.Item>
      <Descriptions.Item label="备注">
        {customer.remark || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="创建时间">
        {dayjs(customer.createdAt).format('YYYY-MM-DD HH:mm')}
      </Descriptions.Item>
      <Descriptions.Item label="更新时间">
        {dayjs(customer.updatedAt).format('YYYY-MM-DD HH:mm')}
      </Descriptions.Item>
    </Descriptions>
  );
};

const TeamSection: React.FC<{
  members: CustomerMemberRow[] | null;
  loading: boolean;
  ownerName: string | null;
}> = ({ members, loading, ownerName }) => {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  const items = members ?? [];
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Text strong>负责人</Text>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
            padding: 8,
            border: '1px solid #f0f0f0',
            borderRadius: 6,
          }}
        >
          <Avatar icon={<TeamOutlined />} />
          <Text>{ownerName ?? '—'}</Text>
        </div>
      </div>
      <Text strong>协同人</Text>
      <div style={{ marginTop: 6 }}>
        {items.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无协同人"
          />
        ) : (
          <List
            size="small"
            dataSource={items}
            renderItem={(m) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar>{m.userName?.slice(0, 1) ?? '?'}</Avatar>}
                  title={m.userName ?? `用户 ${m.userId}`}
                  description={`角色：${m.role}`}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};

const FilesPlaceholder: React.FC = () => {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="文件柜开发中"
      style={{ padding: '40px 0' }}
    />
  );
};

const LogSection: React.FC<{
  transfers: TransferLogRow[] | null;
  loading: boolean;
}> = ({ transfers, loading }) => {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  const items = transfers ?? [];
  if (items.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="暂无操作日志"
      />
    );
  }
  return (
    <Timeline
      items={items.map((t) => ({
        children: (
          <div>
            <div>
              <Text type="secondary" style={{ marginRight: 8 }}>
                {dayjs(t.createdAt).format('YYYY-MM-DD HH:mm')}
              </Text>
              <Text strong>
                {TRANSFER_LABEL[t.type] ?? t.type}
              </Text>
            </div>
            <div style={{ marginTop: 4, fontSize: 13 }}>
              {t.type === 'claim' && t.toUserName && (
                <>{t.operatorUserName ?? '系统'} 认领了该客户</>
              )}
              {t.type === 'release' && t.fromUserName && (
                <>{t.fromUserName} 释放了该客户</>
              )}
              {t.type === 'transfer' && t.fromUserName && t.toUserName && (
                <>
                  {t.fromUserName} → {t.toUserName}（操作人：
                  {t.operatorUserName ?? '—'}）
                </>
              )}
              {t.type === 'assign' && (
                <>分配给 {t.toUserName ?? `用户 ${t.toUserId}`}</>
              )}
              {t.reason && (
                <span style={{ color: '#8c8c8c', marginLeft: 8 }}>
                  原因：{t.reason}
                </span>
              )}
            </div>
          </div>
        ),
      }))}
    />
  );
};

export default MoreTab;
