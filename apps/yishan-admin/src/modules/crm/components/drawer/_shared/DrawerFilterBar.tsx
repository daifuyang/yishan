import { CalendarOutlined, FilterFilled } from '@ant-design/icons';
import { Button, DatePicker, Form, Popover } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useState } from 'react';

const { RangePicker } = DatePicker;

export interface DrawerFilterOption<T extends string> {
  key: T;
  label: string;
}

export interface DrawerFilterBarProps<T extends string> {
  /**
   * 分类筛选按钮组。
   * - 不传或空数组：只渲染日期范围控件（适合 Overview/MoreTab）
   * - 传入：渲染完整 filter 行（适合 ActivityRail）
   */
  options?: DrawerFilterOption<T>[];
  value?: T;
  onChange?: (next: T) => void;
  /**
   * 日期范围筛选（可选）。传 enabled 后右侧渲染「筛选」按钮 + Popover，
   * 内部用 Form 管 RangePicker。onChange 给 ISO 字符串，调用方自行过滤。
   */
  dateRange?:
    | false
    | {
        value: { from?: string; to?: string } | null;
        onChange: (next: { from?: string; to?: string } | null) => void;
      };
  /** 加载态：仅影响 cursor；不阻塞 click。 */
  loading?: boolean;
}

/**
 * Drawer Activity 区域顶部的 filter 行。
 *
 * 视觉：
 *   - 左：分类按钮组（高亮主色），可省略
 *   - 右：「筛选」按钮 → Popover(创建时间 RangePicker)，可省略
 *
 * 业务：
 *   - 选项 / 当前值 / 变更回调由调用方决定（本组件不绑 lead/customer 业务枚举）
 *   - 日期范围通过 prop 传；不传则不渲染筛选按钮
 */
function DrawerFilterBar<T extends string>({
  options,
  value,
  onChange,
  dateRange,
}: DrawerFilterBarProps<T>) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  const hasOptions = options && options.length > 0;
  const hasDateRange = Boolean(dateRange);
  const optionList = options ?? [];

  if (!hasOptions && !hasDateRange) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginTop: 14,
        whiteSpace: 'nowrap',
      }}
    >
      {hasOptions &&
        optionList.map((opt) => {
          const active = opt.key === value;
          return (
            <Button
              key={opt.key}
              type="text"
              size="small"
              onClick={() => onChange?.(opt.key)}
              style={{
                padding: 0,
                color: active ? '#1677ff' : '#667085',
                fontWeight: active ? 500 : 400,
              }}
            >
              {opt.label}
            </Button>
          );
        })}
      {hasDateRange && (
        <Popover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          trigger="hover"
          mouseEnterDelay={0.1}
          mouseLeaveDelay={0.2}
          content={
            <Form
              layout="vertical"
              initialValues={{
                dateRange:
                  dateRange &&
                  'value' in dateRange &&
                  dateRange.value?.from &&
                  dateRange.value?.to
                    ? [dayjs(dateRange.value.from), dayjs(dateRange.value.to)]
                    : undefined,
              }}
              onValuesChange={(_, values) => {
                const range = values.dateRange as
                  | [Dayjs, Dayjs]
                  | undefined;
                if (dateRange && 'onChange' in dateRange) {
                  dateRange.onChange(
                    range
                      ? {
                          from: range[0].startOf('day').toISOString(),
                          to: range[1].endOf('day').toISOString(),
                        }
                      : null,
                  );
                }
              }}
              style={{ width: 280 }}
            >
              <Form.Item
                label="创建时间"
                name="dateRange"
                style={{ margin: 0 }}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Form>
          }
        >
          <Button
            type="link"
            size="small"
            icon={<FilterFilled />}
            style={{
              marginLeft: hasOptions ? 'auto' : 0,
              paddingInline: 0,
              color:
                dateRange && 'value' in dateRange && dateRange.value
                  ? '#1677ff'
                  : undefined,
            }}
            onClick={() => setPopoverOpen((v) => !v)}
          >
            {dateRange && 'value' in dateRange && dateRange.value ? (
              <CalendarOutlined style={{ marginRight: 4 }} />
            ) : null}
            筛选
          </Button>
        </Popover>
      )}
    </div>
  );
}

export default DrawerFilterBar;
