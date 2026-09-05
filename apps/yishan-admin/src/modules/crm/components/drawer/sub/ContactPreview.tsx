/**
 * 单联系人紧凑预览（用于 OverviewTab 右侧"联系人"卡片）。
 *
 * 单行：头像 + 姓名 + 职位 + 脱敏手机号。点击整行切换到 ContactsTab。
 */

import { UserOutlined } from '@ant-design/icons';
import { Avatar, Space, Typography } from 'antd';
import React from 'react';
import type { ContactRow } from '@/services/crm';
import { maskPhone } from '@/services/crm';

const { Text } = Typography;

export interface ContactPreviewProps {
  contact: ContactRow;
  onClick?: () => void;
}

const ContactPreview: React.FC<ContactPreviewProps> = ({ contact, onClick }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <div
      onClick={onClick ? handleClick : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 4px',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
      }}
      role={onClick ? 'button' : undefined}
    >
      <Avatar size={32} icon={<UserOutlined />} style={{ flexShrink: 0 }}>
        {contact.name?.slice(0, 1)}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Space size={6} align="center">
          <Text strong style={{ fontSize: 13 }}>
            {contact.name}
          </Text>
          {contact.isPrimary === 1 && (
            <span
              style={{
                fontSize: 11,
                color: '#1677ff',
                background: '#e6f4ff',
                padding: '0 6px',
                borderRadius: 8,
              }}
            >
              主
            </span>
          )}
        </Space>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
          {[contact.position, maskPhone(contact.mobile)]
            .filter(Boolean)
            .join(' · ') || '—'}
        </div>
      </div>
    </div>
  );
};

export default ContactPreview;
