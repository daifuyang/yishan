/**
 * 客户 Drawer — Contacts Tab。
 *
 * 每行卡片：姓名 + 职位 + 手机 + 邮箱 + tags + [编辑] [删除]。
 * 删除走 Popconfirm 二次确认。
 *
 * 父组件控制新建/编辑/删除实际行为，本组件只负责 UI + 把意图抛上去。
 */

import {
  EditOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import React from 'react';
import type { ContactRow } from '@/services/crm';
import { maskPhone } from '@/services/crm';
import { usePermission } from '@/utils/permission';

const { Text } = Typography;

export interface ContactsTabProps {
  contacts: ContactRow[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (contact: ContactRow) => void;
  onDelete: (contact: ContactRow) => void;
}

const ContactsTab: React.FC<ContactsTabProps> = ({
  contacts,
  loading,
  onCreate,
  onEdit,
  onDelete,
}) => {
  const can = usePermission();
  const canCreate = can('crm:contact:create');
  const canUpdate = can('crm:contact:update');
  const canDelete = can('crm:contact:delete');

  if (loading) {
    return (
      <Card>
        <div style={{ padding: 24, color: '#bfbfbf' }}>加载中…</div>
      </Card>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 4px 12px',
        }}
      >
        <Text strong style={{ fontSize: 14 }}>
          联系人
          <Text
            type="secondary"
            style={{ fontSize: 12, marginLeft: 8, fontWeight: 400 }}
          >
            共 {contacts.length}
          </Text>
        </Text>
        {canCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreate}
          >
            新建联系人
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无联系人"
          >
            {canCreate && (
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={onCreate}
              >
                新建联系人
              </Button>
            )}
          </Empty>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {contacts.map((c) => (
            <Card
              key={c.id}
              size="small"
              bodyStyle={{ padding: 14 }}
              hoverable
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <Avatar size={40} style={{ flexShrink: 0 }}>
                  {c.name?.slice(0, 1)}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Space size={6} align="center">
                    <Text strong style={{ fontSize: 14 }}>
                      {c.name}
                    </Text>
                    {c.isPrimary === 1 && (
                      <Tag color="blue" style={{ margin: 0 }}>
                        主联系人
                      </Tag>
                    )}
                    {c.gender === 1 && (
                      <Tag style={{ margin: 0 }}>男</Tag>
                    )}
                    {c.gender === 2 && (
                      <Tag style={{ margin: 0 }}>女</Tag>
                    )}
                  </Space>
                  {(c.position || c.department) && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#8c8c8c',
                        marginTop: 2,
                      }}
                    >
                      {[c.department, c.position].filter(Boolean).join(' / ')}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 12,
                      color: '#595959',
                    }}
                  >
                    {c.mobile && (
                      <span>
                        <PhoneOutlined style={{ marginRight: 6 }} />
                        {maskPhone(c.mobile)}
                      </span>
                    )}
                    {c.email && (
                      <span>
                        <MailOutlined style={{ marginRight: 6 }} />
                        {c.email}
                      </span>
                    )}
                  </div>
                  {(canUpdate || canDelete) && (
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        gap: 12,
                      }}
                    >
                      {canUpdate && (
                        <a onClick={() => onEdit(c)}>
                          <EditOutlined style={{ marginRight: 4 }} />
                          编辑
                        </a>
                      )}
                      {canDelete && (
                        <Popconfirm
                          title={`确认删除「${c.name}」？`}
                          okText="删除"
                          okButtonProps={{ danger: true }}
                          cancelText="取消"
                          onConfirm={() => onDelete(c)}
                        >
                          <a style={{ color: '#ff4d4f' }}>删除</a>
                        </Popconfirm>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactsTab;
