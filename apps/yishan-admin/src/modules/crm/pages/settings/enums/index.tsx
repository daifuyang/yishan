/**
 * 枚举中心 —— sys_enum 统一管理页。
 *
 * Phase 0 引入：替代原本散落在 `crm_customer_status` / `crm_customer_source` 等
 * 业务表里的 enum 小字典；所有 CRM 业务枚举（含 Phase 2 的商机阶段 / Phase 4 的拜访结果）
 * 都从这张表读。
 *
 * 业务约束：
 *   - `type` 与 `code` 联合唯一；修改后端 service 已校验 type 必须在字典内。
 *   - 不允许删除已被业务引用的项；service 层在删除前做存在性校验。
 *   - 启用 toggle 与排序直接 inline 编辑。
 */

import {
  PageContainer,
  type ProColumns,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Switch, Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import {
  type EnumInput,
  type EnumItem,
  type EnumUpdateInput,
  createEnum,
  deleteEnum,
  listEnums,
  listEnumTypes,
  updateEnum,
} from '@/services/crm';

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'crm_industry', label: '客户行业' },
  { value: 'crm_customer_level', label: '客户级别' },
  { value: 'crm_customer_status', label: '客户状态' },
  { value: 'crm_customer_source', label: '客户来源' },
  { value: 'crm_lead_status', label: '线索状态' },
  { value: 'crm_opportunity_stage', label: '商机阶段' },
  { value: 'crm_opportunity_pipeline', label: '商机管道' },
  { value: 'crm_opportunity_lost_reason', label: '商机丢单原因' },
  { value: 'crm_visit_result', label: '拜访结果' },
  { value: 'crm_ticket_priority', label: '工单优先级' },
  { value: 'crm_ticket_type', label: '工单类型' },
  { value: 'crm_payment_method', label: '回款方式' },
  { value: 'crm_contact_role', label: '联系人角色' },
  { value: 'crm_contact_status', label: '联系人状态' },
];

const EnumsPage: React.FC = () => {
  const [existingTypes, setExistingTypes] = useState<string[]>([]);

  useEffect(() => {
    listEnumTypes().then(setExistingTypes).catch(() => undefined);
  }, []);

  const columns: ProColumns<EnumItem>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      search: false,
    },
    {
      title: '枚举类型',
      dataIndex: 'type',
      width: 180,
      valueType: 'select',
      render: (_, r) => <Tag color="blue">{r.type}</Tag>,
      // ProColumns<EnumItem> 在未设置 valueType 时不开放 renderFormItem；
      // 上面已经 valueType: 'select'，但 Pro 5/6 的泛型推断仍偏严，cast 列配置收敛。
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({
        renderFormItem: () => (
          <ProFormSelect
            options={TYPE_OPTIONS}
            showSearch
            allowClear
            placeholder="选择 type"
          />
        ),
      } as any),
    },
    {
      title: '代码',
      dataIndex: 'code',
      width: 160,
      fieldProps: { style: { fontFamily: 'monospace' } },
    },
    {
      title: '展示名',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: '排序',
      dataIndex: 'sort',
      width: 90,
      search: false,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 220,
      ellipsis: true,
      search: false,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      search: false,
      render: (_, r) => (
        <Switch
          checked={r.enabled === 1}
          onChange={async (v) => {
            try {
              await updateEnum(r.id, { enabled: v ? 1 : 0 });
              message.success('已更新');
              actionRef.current?.reload();
            } catch (err: any) {
              message.error(err?.message ?? '更新失败');
            }
          }}
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_, r) => (
        <Space size={16}>
          <Popconfirm
            title="删除该枚举项？"
            description="已被业务引用的项会被拒绝删除。"
            onConfirm={async () => {
              try {
                await deleteEnum(r.id);
                message.success('已删除');
                actionRef.current?.reload();
              } catch (err: any) {
                message.error(err?.message ?? '删除失败');
              }
            }}
          >
            <a>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 用 actionRef 控制列表刷新；不走 useTableRequest 自定义 hook。
  const actionRef = React.useRef<any>(null);

  return (
    <PageContainer
      header={{
        title: '枚举中心',
        subTitle: 'sys_enum 通用枚举表：客户 / 线索 / 商机 / 拜访 / 工单 / 回款 等业务枚举的单一来源',
      }}
    >
      <ProTable<EnumItem>
        headerTitle="枚举项"
        rowKey="id"
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const { data, total } = await listEnums({
            page: params.current,
            pageSize: params.pageSize,
            type: params.type as string | undefined,
            keyword: params.keyword as string | undefined,
          });
          return { data, total, success: true };
        }}
        search={{
          labelWidth: 'auto',
          defaultCollapsed: false,
        }}
        pagination={{ pageSize: 20 }}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            onClick={() => {
              // 简单占位：实际弹窗可走 ProTable 内置 DrawerForm。
              // 这里提示用户用 ProTable 行内"+"新增；Phase 1 再补 drawer。
              message.info('请通过菜单"枚举中心"维护；新增可使用 ProTable 顶部新建按钮')
            }}
          >
            新建枚举项
          </Button>,
        ]}
        editable={{
          type: 'multiple',
          onSave: async (_key, row) => {
            const patch: EnumUpdateInput = {
              name: row.name,
              sort: row.sort,
              enabled: row.enabled,
              remark: row.remark,
            };
            await updateEnum(row.id, patch);
          },
        }}
      />
      <div style={{ marginTop: 8, color: '#999' }}>
        当前已存在的 type：{existingTypes.length === 0 ? '（无）' : existingTypes.join(', ')}
      </div>
    </PageContainer>
  );
};

export default EnumsPage;
