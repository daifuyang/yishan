/**
 * 客户列表页 View 切换条。
 *
 * 系统 View：全部 / 待跟进 / 重点。
 * 自定义视图尚未开放，不在当前 tab bar 提供入口。
 *
 * URL 同步由 useCustomerFilterUrl 负责；本组件只渲染 + 触发 setView。
 */

import { Tabs } from 'antd';
import React from 'react';
import {
  SYSTEM_VIEWS,
  type SystemViewId,
} from '../../utils/customerViewFilters';

export interface CustomerViewTabsProps {
  value: SystemViewId;
  onChange: (view: SystemViewId) => void;
}

const CustomerViewTabs: React.FC<CustomerViewTabsProps> = ({
  value,
  onChange,
}) => {
  const items = SYSTEM_VIEWS.map((v) => ({
    key: v.id,
    label: v.name,
  }));

  return (
    <Tabs
      activeKey={value}
      onChange={(key) => onChange(key as SystemViewId)}
      items={items}
    />
  );
};

export default CustomerViewTabs;
