import { Popconfirm } from 'antd';
import React from 'react';

export interface DrawerDeletePopconfirmProps {
  /** 删除的目标文案，如 `线索 #42` 或客户名。 */
  targetName: React.ReactNode;
  /** 描述：删除后的副作用说明。 */
  description?: React.ReactNode;
  onConfirm: () => void;
  /** 包裹的触发节点：通常是「更多」菜单里的一行。 */
  children: React.ReactNode;
}

/**
 * CRM 抽屉统一的删除 Popconfirm。
 *
 * 触发节点传 children（多半是一个菜单项 label）。
 * 颜色与 antd danger 按钮对齐：okButtonProps={{ danger: true }}。
 *
 * 注意：antd 4.x 的 Popconfirm title / description / children 类型不含 React 18.3
 * 的 bigint / Promise 等 ReactNode 子成员；这里在调用点统一收敛到 ReactElement
 * ——运行时完全等价，只是类型版本不兼容。
 */
const DrawerDeletePopconfirm: React.FC<DrawerDeletePopconfirmProps> = ({
  targetName,
  description = '删除后不可见，且无法恢复。',
  onConfirm,
  children,
}) => {
  const titleNode = (
    <span>
      删除
      <strong style={{ marginLeft: 4 }}>{targetName}</strong>
      ？
    </span>
  );
  return (
    // antd 4.x Popconfirm 子类型与 React 18.3 ReactNode union 不兼容
    // (bigint / Promise)；显式 cast 收敛类型，运行时无影响
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Popconfirm
      title={titleNode as any}
      description={(description as any) ?? undefined}
      okText="删除"
      okButtonProps={{ danger: true }}
      cancelText="取消"
      onConfirm={onConfirm}
      onPopupClick={(e) => e.stopPropagation()}
    >
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {children as any}
    </Popconfirm>
  );
};

export default DrawerDeletePopconfirm;
