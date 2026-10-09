import { Drawer, Descriptions } from 'antd';
import React from 'react';

export interface EntityDetailDrawerProps<T extends object> {
  open: boolean;
  title: string;
  record: T | null;
  onClose: () => void;
  fields: Array<{ key: keyof T; label: string; render?: (value: T[keyof T], record: T) => React.ReactNode }>;
}

export function EntityDetailDrawer<T extends object>({
  open,
  title,
  record,
  onClose,
  fields,
}: EntityDetailDrawerProps<T>) {
  return (
    <Drawer open={open} title={title} width={720} onClose={onClose} destroyOnClose>
      <Descriptions bordered column={1} size="small">
        {record && fields.map((field) => (
          <Descriptions.Item key={String(field.key)} label={field.label}>
            {field.render ? field.render(record[field.key], record) : (String(record[field.key] ?? '-') as any)}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </Drawer>
  );
}

export default EntityDetailDrawer;
