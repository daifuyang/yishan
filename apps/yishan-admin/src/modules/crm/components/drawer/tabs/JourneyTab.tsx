import { Skeleton } from 'antd';
import React, { useEffect, useState } from 'react';
import type { ActivityRow } from '@/services/crm';
import { listActivitiesByCustomer } from '@/services/crm';
import ActivityTimeline from '../sub/ActivityTimeline';

const JourneyTab: React.FC<{ customerId: number }> = ({ customerId }) => {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void listActivitiesByCustomer(customerId).then((result) => active && setItems(result.items)).catch(() => active && setItems([])).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customerId]);
  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />;
  return <ActivityTimeline items={items} groupByDate emptyText="暂无客户历程" />;
};

export default JourneyTab;
