/**
 * 更多筛选 — 右侧 Drawer。
 *
 * 涵盖高级字段（更多筛选里露出来的部分）：
 *   负责人 / 协同人 / 状态 / 等级 / 来源 / 类型 / 行业 / 地区 / 标签 /
 *   创建时间 / 最近跟进 / 下次跟进 / 是否逾期 / 是否有商机
 *
 * 底部"保存为视图"勾选 + 输入框是 Phase 5 占位 —— 当前只 UI 留好，
 * 后端暂未下发视图保存接口，先 disabled。
 */

import { CloseOutlined } from '@ant-design/icons';
import {
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Form,
  Input,
  Select,
  Space,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useEffect } from 'react';
import type {
  CustomerListQuery,
  SourceRow,
  StatusRow,
  TagRow,
} from '@/services/crm';

const { RangePicker } = DatePicker;

const LEVEL_OPTIONS = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
];
const TYPE_OPTIONS = [
  { value: 'enterprise', label: '企业客户' },
  { value: 'individual', label: '个人客户' },
];

export interface AdvancedFilterValues {
  collaboratorId?: number;
  industry?: string;
  province?: string;
  city?: string;
  tagIds?: number[];
  createdRange?: [Dayjs, Dayjs];
  lastFollowUpRange?: [Dayjs, Dayjs];
  nextFollowUpRange?: [Dayjs, Dayjs];
  overdueOnly?: boolean;
  hasOpportunity?: boolean;
  saveAsView?: boolean;
  newViewName?: string;
}

export interface CustomerAdvancedFilterDrawerProps {
  open: boolean;
  values: AdvancedFilterValues;
  onClose: () => void;
  onApply: (next: AdvancedFilterValues) => void;
  onReset: () => void;
  statuses: StatusRow[];
  sources: SourceRow[];
  tags: TagRow[];
}

const CustomerAdvancedFilterDrawer: React.FC<
  CustomerAdvancedFilterDrawerProps
> = ({ open, values, onClose, onApply, onReset, statuses, sources, tags }) => {
  const [form] = Form.useForm<AdvancedFilterValues>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue(values);
    } else {
      form.resetFields();
    }
  }, [open, values, form]);

  const statusOptions = React.useMemo(
    () =>
      statuses
        .filter((s) => s.enabled === 1)
        .map((s) => ({ value: s.id, label: s.name })),
    [statuses],
  );
  const sourceOptions = React.useMemo(
    () =>
      sources
        .filter((s) => s.enabled === 1)
        .map((s) => ({ value: s.id, label: s.name })),
    [sources],
  );
  const tagOptions = React.useMemo(
    () =>
      tags
        .filter((t) => t.enabled === 1)
        .map((t) => ({ value: t.id, label: t.name })),
    [tags],
  );

  const handleApply = async () => {
    const v = await form.validateFields();
    onApply(v);
  };

  const handleReset = () => {
    form.resetFields();
    onReset();
  };

  return (
    <Drawer
      title="更多筛选"
      open={open}
      width={520}
      onClose={onClose}
      destroyOnClose
      extra={
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          aria-label="关闭"
        />
      }
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button onClick={handleReset}>重置</Button>
          <Button type="primary" onClick={handleApply}>
            应用筛选
          </Button>
        </Space>
      }
    >
      <Form<AdvancedFilterValues>
        form={form}
        layout="vertical"
        initialValues={values}
        onFinish={handleApply}
      >
        <Form.Item label="协同人" name="collaboratorId">
          <InputNumberLike placeholder="协同人用户 ID" />
        </Form.Item>
        <Form.Item label="客户状态" name="statusId">
          <Select allowClear options={statusOptions} placeholder="全部状态" />
        </Form.Item>
        <Form.Item label="客户等级" name="level">
          <Select allowClear options={LEVEL_OPTIONS} placeholder="全部等级" />
        </Form.Item>
        <Form.Item label="客户来源" name="sourceId">
          <Select allowClear options={sourceOptions} placeholder="全部来源" />
        </Form.Item>
        <Form.Item label="客户类型" name="type">
          <Select allowClear options={TYPE_OPTIONS} placeholder="全部类型" />
        </Form.Item>
        <Form.Item label="所属行业" name="industry">
          <Input allowClear placeholder="如：软件服务" maxLength={64} />
        </Form.Item>
        <Form.Item label="所属地区" name="region">
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="province" noStyle>
              <Input placeholder="省份" maxLength={64} />
            </Form.Item>
            <Form.Item name="city" noStyle>
              <Input placeholder="城市" maxLength={64} />
            </Form.Item>
          </Space.Compact>
        </Form.Item>
        <Form.Item label="标签" name="tagIds">
          <Select
            mode="multiple"
            allowClear
            options={tagOptions}
            placeholder="按标签筛选"
          />
        </Form.Item>
        <Form.Item label="创建时间" name="createdRange">
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="最近跟进时间" name="lastFollowUpRange">
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="下次跟进时间" name="nextFollowUpRange">
          <RangePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="其他条件">
          <Space direction="vertical" size={4}>
            <Form.Item name="overdueOnly" noStyle valuePropName="checked">
              <Checkbox>仅显示逾期未跟进</Checkbox>
            </Form.Item>
            <Form.Item name="hasOpportunity" noStyle valuePropName="checked">
              <Checkbox disabled>仅显示有商机（Phase 3 启用）</Checkbox>
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item label="保存为视图" name="saveAsView" valuePropName="checked">
          <Checkbox disabled>保存为我的视图（Phase 5 启用）</Checkbox>
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, curr) => prev.saveAsView !== curr.saveAsView}
        >
          {({ getFieldValue }) =>
            getFieldValue('saveAsView') ? (
              <Form.Item label="视图名称" name="newViewName">
                <Input placeholder="例如：本季度重点客户" maxLength={32} />
              </Form.Item>
            ) : null
          }
        </Form.Item>
      </Form>
    </Drawer>
  );
};

/**
 * 用 Input + parser 模拟 ProFormDigit 行为，但不接 antd 数字控件避免和 Form
 * 内部的 string/number 类型打架。后续如需数字键盘，替换为 antd InputNumber 即可。
 */
const InputNumberLike: React.FC<{ placeholder?: string }> = ({
  placeholder,
}) => {
  return (
    <Input
      placeholder={placeholder}
      type="number"
      min={1}
      onChange={() => {
        // 实际取值在 onApply 里通过 getFieldsValue() 拿到；
        // 这里不返回任何值，避免与 Form 期望的 void handler 冲突。
      }}
    />
  );
};

/** RangePicker dayjs → ISO 的工具，便于把表单值转回 CustomerListQuery。 */
export function rangeToFromTo(range: [Dayjs, Dayjs] | undefined): {
  from?: string;
  to?: string;
} {
  if (!range) return {};
  return {
    from: range[0]?.toISOString(),
    to: range[1]?.toISOString(),
  };
}

/** ISO → dayjs RangePicker 的工具。 */
export function fromToToRange(
  from?: string,
  to?: string,
): [Dayjs, Dayjs] | undefined {
  if (!from || !to) return undefined;
  const a = dayjs(from);
  const b = dayjs(to);
  if (!a.isValid() || !b.isValid()) return undefined;
  return [a, b];
}

export function advancedToQuery(
  v: AdvancedFilterValues,
): Partial<CustomerListQuery> {
  const out: Partial<CustomerListQuery> = {};
  if (v.collaboratorId) out.collaboratorId = v.collaboratorId;
  if (v.industry) out.industry = v.industry;
  if (v.province) out.province = v.province;
  if (v.city) out.city = v.city;
  if (v.tagIds && v.tagIds.length > 0) out.tagIds = v.tagIds;
  if (v.createdRange) {
    out.createdFrom = v.createdRange[0].toISOString();
    out.createdTo = v.createdRange[1].toISOString();
  }
  if (v.lastFollowUpRange) {
    out.lastFollowUpFrom = v.lastFollowUpRange[0].toISOString();
    out.lastFollowUpTo = v.lastFollowUpRange[1].toISOString();
  }
  if (v.nextFollowUpRange) {
    out.nextFollowUpFrom = v.nextFollowUpRange[0].toISOString();
    out.nextFollowUpTo = v.nextFollowUpRange[1].toISOString();
  }
  return out;
}

export default CustomerAdvancedFilterDrawer;
