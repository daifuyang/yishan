/**
 * 客户 Drawer 通用占位 Tab。
 *
 * 用于：报价单 / 合同 / 费用 / 已成交产品 / 任务 / 附件 / 操作日志 / 线索
 * 这几个 tab 暂时没有可消费的后端列表接口（CRM Phase 3 计划中），
 * 统一渲染一个 Empty + 文案 + disabled [新建] 按钮，避免每个 tab 写一遍近似代码。
 *
 * 当后端接口就绪后，可以逐个替换为真正的 Tab；调用方只需在
 * `CustomerDrawer.TAB_LABELS` 把对应 key 的 children 从 `<PlaceholderTab />`
 * 换成新的实现即可。
 */

import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Empty } from 'antd';
import React from 'react';

export interface PlaceholderTabProps {
  /** Tab 名称，用于 Empty description 与新建按钮文案。如「报价单」「合同」。 */
  entity: string;
  /** 自定义 description 文案（可选）。默认 `${entity}功能开发中（Phase 3）`。 */
  description?: string;
  /** 自定义 [新建] 按钮文案（可选）。默认 `新建${entity}`。 */
  createLabel?: string;
}

const PlaceholderTab: React.FC<PlaceholderTabProps> = ({
  entity,
  description,
  createLabel,
}) => {
  return (
    <Card>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={description ?? `${entity}功能开发中（Phase 3）`}
        style={{ padding: '24px 0' }}
      >
        <Button icon={<PlusOutlined />} disabled>
          {createLabel ?? `新建${entity}`}
        </Button>
      </Empty>
    </Card>
  );
};

export default PlaceholderTab;