import { Skeleton } from 'antd';
import React, { useEffect, useState } from 'react';
import type { ActivityRow } from '@/services/crm';
import { listActivitiesByCustomer, listAllPages, listContracts, listOpportunities, listPaymentsByContract, listQuotations } from '@/services/crm';
import ActivityTimeline from '../sub/ActivityTimeline';
import { buildCustomerSystemEvents } from './journeyEvents';

const JourneyTab: React.FC<{ customerId: number }> = ({ customerId }) => {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void Promise.all([
      listActivitiesByCustomer(customerId),
      listAllPages((page, pageSize) => listOpportunities({ customerId, page, pageSize })),
      listAllPages((page, pageSize) => listQuotations({ customerId, page, pageSize })),
      listAllPages((page, pageSize) => listContracts({ customerId, page, pageSize })),
    ]).then(async ([activities, opportunities, quotations, contracts]) => {
      const payments = (await Promise.all(contracts.map((contract) => listPaymentsByContract(contract.id)))).flat();
      if (active) setItems([...activities.items, ...buildCustomerSystemEvents({ opportunities, quotations, contracts, payments })].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)));
    }).catch(() => active && setItems([])).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customerId]);
  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;
  return <ActivityTimeline items={items} groupByDate emptyText="暂无客户历程" />;
};

export default JourneyTab;
