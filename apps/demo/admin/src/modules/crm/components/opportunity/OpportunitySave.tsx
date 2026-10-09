/**
 * 全局商机列表的新建入口。表单实现复用 OpportunityCreateModal。
 */

import React from 'react';
import OpportunityCreateModal from '../drawer/tabs/OpportunityCreateModal';

export interface OpportunitySaveProps {
  children: React.ReactElement<{ onClick?: () => void }>;
  customerId?: number;
  customerName?: string;
  ownerId?: number;
  ownerName?: string | null;
  onFinish?: () => void | Promise<void>;
}

export default function OpportunitySave({
  children,
  customerId,
  customerName,
  ownerId,
  ownerName,
  onFinish,
}: OpportunitySaveProps) {
  return (
    <OpportunityCreateModal
      trigger={children}
      customerId={customerId}
      customerName={customerName}
      ownerId={ownerId}
      ownerName={ownerName}
      onSuccess={() => {
        void onFinish?.();
      }}
    />
  );
}
