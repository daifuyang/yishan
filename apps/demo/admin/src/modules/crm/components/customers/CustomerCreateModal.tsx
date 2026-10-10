/**
 * 新建客户 ModalForm。挂在客户列表工具栏，成功后由父级刷新列表并打开详情 Drawer。
 *
 * 负责人取当前用户，不在表单里选。客户状态创建后由跟进事实推进，这里只展示默认「潜在」。
 */

import type { ProFormInstance } from '@ant-design/pro-components';
import {
  ModalForm,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Col, Row, Typography } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ProFormRegionCascader } from '@/components';
import { CUSTOMER_STATUSES } from '@/modules/crm/domain/statuses';
import {
  type CustomerCreateInput,
  type CustomerRow,
  createContactForCustomer,
  createCustomer,
  listEnumByType,
  type SourceRow,
  type TagRow,
} from '@/services/crm';
import { getSystemRegionList } from '@yishan/core-system-admin/services/systemRegions';

const { Text } = Typography;

const MOBILE_REGEX = /^1[3-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TYPE_OPTIONS = [
  { value: 'enterprise', label: '企业客户' },
  { value: 'individual', label: '个人客户' },
];

const FALLBACK_LEVEL_OPTIONS = [
  { value: 'A', label: 'A 类（重点）' },
  { value: 'B', label: 'B 类（潜在）' },
  { value: 'C', label: 'C 类（一般）' },
  { value: 'D', label: 'D 类（低优先）' },
];

export interface CustomerCreateModalProps {
  children: React.ReactElement<{ onClick?: () => void }>;
  sources: SourceRow[];
  tags: TagRow[];
  currentUserId?: number;
  currentUserName?: string;
  onSuccess?: (customer: CustomerRow) => void;
}

interface FormValues {
  name?: string;
  type?: 'enterprise' | 'individual';
  industry?: string;
  sourceId?: number;
  contactName?: string;
  contactPosition?: string;
  phone?: string;
  email?: string;
  statusCode?: string;
  level?: string;
  ownerDisplay?: string;
  tagIds?: number[];
  region?: number[];
  address?: string;
  remark?: string;
}

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function SectionTitle({ text }: { text: string }) {
  return (
    <Text
      type="secondary"
      style={{ display: 'block', margin: '4px 0 8px', fontSize: 13 }}
    >
      {text}
    </Text>
  );
}

async function resolveRegionNames(codes: number[] | undefined): Promise<{
  province?: string;
  city?: string;
}> {
  if (!codes?.length) return {};
  const [provinceCode, cityCode] = codes;
  const provinces = await getSystemRegionList({ parentCode: 0 });
  const province = provinces.data?.find((item) => item.code === provinceCode)
    ?.name;
  if (!cityCode) return { province };
  const cities = await getSystemRegionList({ parentCode: provinceCode });
  const city = cities.data?.find((item) => item.code === cityCode)?.name;
  return { province, city };
}

const CustomerCreateModal: React.FC<CustomerCreateModalProps> = ({
  children,
  sources,
  tags,
  currentUserId,
  currentUserName,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const formRef = useRef<ProFormInstance<FormValues>>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [levelOptions, setLevelOptions] = useState(FALLBACK_LEVEL_OPTIONS);

  useEffect(() => {
    let cancelled = false;
    listEnumByType('crm_customer_level')
      .then((items) => {
        if (cancelled || items.length === 0) return;
        setLevelOptions(items.map((item) => ({ value: item.code, label: item.name })));
      })
      .catch(() => {
        // 枚举失败时沿用 A/B/C/D 兜底，不阻塞开窗。
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sourceOptions = useMemo(
    () =>
      sources
        .filter((item) => item.enabled === 1)
        .map((item) => ({ value: item.id, label: item.name })),
    [sources],
  );
  const tagOptions = useMemo(
    () =>
      tags
        .filter((item) => item.enabled === 1)
        .map((item) => ({ value: item.id, label: item.name })),
    [tags],
  );
  const statusOptions = useMemo(
    () => CUSTOMER_STATUSES.map((item) => ({ value: item.value, label: item.label })),
    [],
  );

  const initialValues = useMemo<FormValues>(
    () => ({
      type: 'enterprise',
      statusCode: 'potential',
      level: 'C',
      ownerDisplay: currentUserName?.trim() || '当前用户',
    }),
    [currentUserName],
  );

  const resetForOpen = () => {
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue(initialValues);
  };

  return (
    <ModalForm<FormValues>
      title="新建客户"
      width={720}
      layout="vertical"
      autoFocusFirstInput
      trigger={React.cloneElement(children, { onClick: resetForOpen })}
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{
        destroyOnHidden: true,
        maskClosable: false,
        styles: {
          body: {
            padding: '8px 24px 4px',
          },
        },
      }}
      submitter={{
        searchConfig: { submitText: '创建', resetText: '取消' },
        submitButtonProps: { loading: submitting },
      }}
      onFinish={async (raw) => {
        const name = clean(raw.name);
        if (!name) {
          message.error('请填写客户名称');
          return false;
        }
        if (currentUserId == null) {
          message.error('无法识别当前用户，请重新登录后再试');
          return false;
        }

        const phone = clean(raw.phone);
        const email = clean(raw.email);
        const contactName = clean(raw.contactName);
        if ((raw.contactPosition || phone || email) && !contactName) {
          message.error('请填写联系人姓名');
          return false;
        }

        setSubmitting(true);
        try {
          const { province, city } = await resolveRegionNames(raw.region);
          const input: CustomerCreateInput = {
            name,
            type: raw.type ?? 'enterprise',
            level: raw.level ?? 'C',
            ownerUserId: currentUserId,
          };
          if (raw.sourceId != null) input.sourceId = raw.sourceId;
          const industry = clean(raw.industry);
          if (industry) input.industry = industry;
          if (phone) input.phone = phone;
          if (province) input.province = province;
          if (city) input.city = city;
          const address = clean(raw.address);
          if (address) input.address = address;
          if (raw.tagIds?.length) input.tagIds = raw.tagIds;
          const remark = clean(raw.remark);
          if (remark) input.remark = remark;
          const { customer } = await createCustomer(input);

          if (contactName) {
            try {
              await createContactForCustomer(customer.id, {
                name: contactName,
                position: clean(raw.contactPosition) ?? null,
                mobile: phone ?? null,
                email: email ?? null,
                isPrimary: 1,
              });
            } catch (err) {
              message.warning(
                err instanceof Error
                  ? `客户已创建，联系人未保存：${err.message}`
                  : '客户已创建，联系人未保存',
              );
            }
          }

          message.success('客户创建成功');
          onSuccess?.(customer);
          return true;
        } catch (err) {
          message.error(err instanceof Error ? err.message : '客户创建失败');
          return false;
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <SectionTitle text="基础信息" />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="name"
            label="客户名称"
            placeholder="请输入客户名称"
            rules={[
              { required: true, whitespace: true, message: '请填写客户名称' },
              { max: 200, message: '客户名称最多 200 个字符' },
            ]}
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="type"
            label="客户类型"
            options={TYPE_OPTIONS}
            allowClear={false}
          />
        </Col>
        <Col span={12}>
          <ProFormText
            name="industry"
            label="所属行业"
            placeholder="如：软件服务"
            fieldProps={{ maxLength: 64 }}
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="sourceId"
            label="客户来源"
            placeholder="请选择来源"
            options={sourceOptions}
            allowClear
          />
        </Col>
      </Row>

      <SectionTitle text="联系人" />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="contactName"
            label="联系人"
            placeholder="请输入联系人姓名"
            rules={[{ max: 30, message: '联系人姓名最多 30 个字符' }]}
          />
        </Col>
        <Col span={12}>
          <ProFormText
            name="contactPosition"
            label="职务"
            placeholder="如：采购经理"
            fieldProps={{ maxLength: 100 }}
          />
        </Col>
        <Col span={12}>
          <ProFormText
            name="phone"
            label="手机号"
            placeholder="请输入手机号"
            fieldProps={{ maxLength: 32 }}
            rules={[
              {
                validator: async (_rule, value) => {
                  if (!value) return;
                  if (MOBILE_REGEX.test(String(value).trim())) return;
                  throw new Error('手机号格式不正确');
                },
              },
            ]}
          />
        </Col>
        <Col span={12}>
          <ProFormText
            name="email"
            label="邮箱"
            placeholder="请输入邮箱"
            fieldProps={{ maxLength: 100 }}
            rules={[
              {
                validator: async (_rule, value) => {
                  if (!value) return;
                  if (EMAIL_REGEX.test(String(value).trim())) return;
                  throw new Error('邮箱格式不正确');
                },
              },
            ]}
          />
        </Col>
      </Row>

      <SectionTitle text="业务信息" />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormSelect
            name="statusCode"
            label="客户状态"
            options={statusOptions}
            disabled
            extra="创建后默认为潜在，后续由跟进推进"
          />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="level"
            label="客户等级"
            options={levelOptions}
            allowClear={false}
          />
        </Col>
        <Col span={12}>
          <ProFormText name="ownerDisplay" label="负责人" disabled />
        </Col>
        <Col span={12}>
          <ProFormSelect
            name="tagIds"
            label="标签"
            placeholder="请选择标签"
            options={tagOptions}
            fieldProps={{ mode: 'multiple', maxTagCount: 'responsive' }}
            allowClear
          />
        </Col>
      </Row>

      <SectionTitle text="其他" />
      <Row gutter={16}>
        <Col span={12}>
          <ProFormRegionCascader name="region" label="地区" />
        </Col>
        <Col span={12}>
          <ProFormText
            name="address"
            label="详细地址"
            placeholder="请输入详细地址"
            fieldProps={{ maxLength: 255 }}
          />
        </Col>
        <Col span={24}>
          <ProFormTextArea
            name="remark"
            label="备注"
            placeholder="补充客户背景、合作意向等"
            fieldProps={{ rows: 3, maxLength: 2000, showCount: true }}
          />
        </Col>
      </Row>
    </ModalForm>
  );
};

export default CustomerCreateModal;
