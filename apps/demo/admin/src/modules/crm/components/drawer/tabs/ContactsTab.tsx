/**
 * 客户 Drawer — Contacts Tab。
 *
 * 每行卡片：姓名 + 职位 + 决策角色 + 手机 + 邮箱 + 主联系人 tag + More 操作。
 * 操作：编辑 / 设为主联系人 / 删除（删除走 Popconfirm 二次确认）。
 *
 * 父组件控制新建/编辑/设为主联系人/删除实际行为，本组件只负责 UI + 把意图抛上去。
 */

import {
  CheckCircleOutlined,
  EditOutlined,
  EllipsisOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  StarOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from 'antd';
import React from 'react';
import type { ContactRow, EnumCodeNameItem } from '@/services/crm';
import { maskPhone } from '@/services/crm';
import { usePermission } from '@/utils/permission';

const { Text } = Typography;

export interface ContactsTabProps {
  contacts: ContactRow[];
  loading: boolean;
  onCreate: () => void;
  onEdit: (contact: ContactRow) => void;
  onSetPrimary: (contact: ContactRow) => void;
  onDelete: (contact: ContactRow) => void;
  /** 决策角色枚举（已在父组件加载好）；key 为 roleCode。 */
  roleEnum?: EnumCodeNameItem[];
}

const ContactsTab: React.FC<ContactsTabProps> = ({
  contacts,
  loading,
  onCreate,
  onEdit,
  onSetPrimary,
  onDelete,
  roleEnum,
}) => {
  const can = usePermission();
  const canCreate = can('crm:contact:create');
  const canUpdate = can('crm:contact:update');
  const canDelete = can('crm:contact:delete');
  const canSetPrimary = can('crm:contact:update');

  const roleName = (code: string | null | undefined): string | null => {
    if (!code || !roleEnum) return null;
    return roleEnum.find((r) => r.code === code)?.name ?? null;
  };

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
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            新建联系人
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无联系人" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {contacts.map((c) => {
            type DropdownItem = NonNullable<MenuProps['items']>[number];
            const menuItems: DropdownItem[] = [
              canUpdate
                ? {
                    key: 'edit',
                    icon: <EditOutlined />,
                    label: '编辑',
                    onClick: () => onEdit(c),
                  }
                : null,
              canSetPrimary && c.isPrimary !== 1
                ? {
                    key: 'set-primary',
                    icon: <StarOutlined />,
                    label: '设为主联系人',
                    onClick: () => onSetPrimary(c),
                  }
                : null,
            ].filter(Boolean) as DropdownItem[];

            const hasActions = menuItems.length > 0 || canDelete;

            return (
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
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <Space size={6} align="center" wrap>
                        <Text strong style={{ fontSize: 14 }}>
                          {c.name}
                        </Text>
                        {c.isPrimary === 1 && (
                          <Tag
                            color="blue"
                            icon={<CheckCircleOutlined />}
                            style={{ margin: 0 }}
                          >
                            主联系人
                          </Tag>
                        )}
                      </Space>
                      {hasActions && (
                        <Dropdown
                          menu={{
                            items: [
                              ...menuItems,
                              menuItems.length > 0 && canDelete
                                ? { type: 'divider' }
                                : null,
                              canDelete
                                ? {
                                    key: 'delete',
                                    icon: null,
                                    label: (
                                      <Popconfirm
                                        title={`确认删除「${c.name}」？`}
                                        okText="删除"
                                        okButtonProps={{ danger: true }}
                                        cancelText="取消"
                                        onConfirm={(e) => {
                                          e?.stopPropagation?.();
                                          onDelete(c);
                                        }}
                                      >
                                        <span style={{ color: '#ff4d4f' }}>
                                          删除联系人
                                        </span>
                                      </Popconfirm>
                                    ),
                                  }
                                : null,
                            ].filter(Boolean) as DropdownItem[],
                          }}
                          trigger={['click']}
                          placement="bottomRight"
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<EllipsisOutlined />}
                            aria-label={`「${c.name}」的操作`}
                          />
                        </Dropdown>
                      )}
                    </div>
                    {(c.position || roleName(c.roleCode)) && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#8c8c8c',
                          marginTop: 4,
                        }}
                      >
                        {[c.position, roleName(c.roleCode)]
                          .filter(Boolean)
                          .join(' · ')}
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
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContactsTab;
