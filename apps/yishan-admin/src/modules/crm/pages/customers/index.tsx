/**
 * CRM 客户列表页（Workspace 重构版）。
 *
 * 结构：
 *   PageContainer
 *   ├ CustomerViewTabs      系统 View 切换
 *   └ ProTable              内建搜索、工具栏操作与客户表（行点击打开 Drawer）
 *
 * 状态来源：
 *   - URL search params  ←→  useCustomerFilterUrl（view / 分页 / 筛选）
 *   - 当前用户           useModel('@@initialState').currentUser
 *   - 字典（状态/来源/标签） listStatuses / listSources / listTags
 *   - 概览计数           getDashboard
 *   - 批量 join         findPrimaryContactsByCustomerIds / findOwnerNamesByUserIds（前端用 dashboard 缓存）
 *
 * 注：本页直接调用 /api/crm/v1/* REST 端点；不直接访问 drizzle，
 * 保持 CLAUDE.md 中"前端绝不访问数据库"的边界。
 */

import { DownOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProTableProps } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { history, useModel } from '@umijs/max';
import { Button, Dropdown, message } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type CustomerRow,
  type CustomerListOptions,
  getCustomerListOptions,
  listCustomers,
  listSources,
  listStatuses,
  listTags,
  type SourceRow,
  type StatusRow,
  type TagRow,
} from '@/services/crm';
import { usePermission } from '@/utils/permission';
import CustomerActionDropdown from '../../components/customers/CustomerActionDropdown';
import {
  buildCustomerTableColumns,
  type CustomerTableColumnsOptions,
} from '../../components/customers/CustomerTableColumns';
import CustomerViewTabs from '../../components/customers/CustomerViewTabs';
import { useCustomerTableStyles } from '../../components/customers/customerTable.styles';
import CustomerDrawer from '../../components/drawer/CustomerDrawer';
import { useCustomerDrawer } from '../../hooks/useCustomerDrawer';
import { useCustomerFilterUrl } from '../../hooks/useCustomerFilterUrl';
import { buildQueryFromView } from '../../utils/customerViewFilters';

const Customers: React.FC = () => {
  const { styles } = useCustomerTableStyles();
  const { initialState } = useModel('@@initialState');
  const can = usePermission();
  const currentUser = initialState?.currentUser;
  const currentUserId = currentUser?.id;

  const {
    view,
    filters,
    pagination,
    setView,
    setFilters,
    setPagination,
    reset,
  } = useCustomerFilterUrl();

  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [listOptions, setListOptions] = useState<CustomerListOptions | null>(
    null,
  );
  const optionsRequest = useRef<{
    userId: number | undefined;
    promise: Promise<CustomerListOptions>;
  } | null>(null);

  const drawer = useCustomerDrawer();

  // 字典 + 概览数据初始化
  useEffect(() => {
    let cancelled = false;
    const loadDicts = async () => {
      try {
        const [s, src, t] = await Promise.all([
          listStatuses({ page: 1, pageSize: 100 }),
          listSources({ page: 1, pageSize: 100 }),
          listTags({ page: 1, pageSize: 100 }),
        ]);
        if (cancelled) return;
        setStatuses(s.data);
        setSources(src.data);
        setTags(t.data);
      } catch (err: unknown) {
        message.error((err as Error)?.message ?? '字典加载失败');
      }
    };
    loadDicts();
    return () => {
      cancelled = true;
    };
  }, []);

  // 表格 ProTable request：根据 view + filters + 分页构造后端 query
  const request: ProTableProps<
    CustomerRow,
    Record<string, unknown>
  >['request'] = async () => {
    try {
      if (
        !optionsRequest.current ||
        optionsRequest.current.userId !== currentUserId
      ) {
        optionsRequest.current = {
          userId: currentUserId,
          promise: getCustomerListOptions(),
        };
      }
      const options = await optionsRequest.current.promise;
      setListOptions(options);
      const query = buildQueryFromView(view, {
        ...filters,
        ownerUserId: options.canFilterOwners ? filters.ownerUserId : undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      });
      const res = await listCustomers(query);
      return {
        data: res.data,
        success: true,
        total: res.total,
      };
    } catch (err: unknown) {
      optionsRequest.current = null;
      message.error((err as Error)?.message ?? '客户列表加载失败');
      return { data: [], success: false, total: 0 };
    }
  };

  const actionRef = useRef<
    import('@ant-design/pro-components').ActionType | null
  >(null);
  const reloadTable = () => {
    optionsRequest.current = null;
    void actionRef.current?.reload();
  };
  const reloadAll = reloadTable;

  // 批量 join（前端轻量补救）：列表当前页的"主要联系人"+"负责人名"
  const [primaryContactMap] = useState<
    Map<number, { name: string; mobile: string | null }>
  >(new Map());
  const [ownerNameMap] = useState<Map<number, string>>(new Map());

  const handleCreate = () => {
    // 简化：与原 page 一致，点击新建直接跳到详情页带 edit=1。
    // 后续 Phase 2 把"新建"也搬进 Drawer 时再换。
    history.push('/crm/customer-detail?create=1');
  };

  const handleOpenDetail = (id: number) => {
    drawer.openDrawer(id);
  };

  const columnOpts = useMemo<CustomerTableColumnsOptions>(
    () => ({
      statuses,
      sources,
      tags,
      currentUserId,
      currentUserName: currentUser?.realName,
      canFilterOwners: listOptions?.canFilterOwners ?? false,
      ownerOptions: listOptions?.owners ?? [],
      primaryContactMap,
      ownerNameMap,
      onOpenDetail: handleOpenDetail,
      onChanged: reloadAll,
      onOpenFollowupDrawer: (id: number) => drawer.openDrawer(id, 'basic'),
    }),
    [
      statuses,
      sources,
      tags,
      currentUserId,
      currentUser?.realName,
      listOptions,
      primaryContactMap,
      ownerNameMap,
      reloadAll,
      drawer,
    ],
  );
  const columns = useMemo(
    () => buildCustomerTableColumns(columnOpts),
    [columnOpts],
  );

  return (
    <PageContainer title="我的客户">
      <CustomerViewTabs value={view} onChange={setView} />

      <ProTable<CustomerRow, Record<string, unknown>>
        className={styles.table}
        size="middle"
        headerTitle="客户列表"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        form={{ initialValues: filters, labelAlign: 'right' }}
        params={{
          ...filters,
          view: buildQueryFromView(view).view,
          page: pagination.page,
          pageSize: pagination.pageSize,
        }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.pageSize,
          showSizeChanger: true,
          onChange: (page, pageSize) => setPagination({ page, pageSize }),
        }}
        request={request}
        onSubmit={(values) => setFilters(values)}
        onReset={reset}
        scroll={{ x: 1400 }}
        rowClassName={() => 'crm-customer-row'}
        onRow={(record) => ({
          onClick: () => handleOpenDetail(record.id),
          style: { cursor: 'pointer' },
        })}
        options={{
          reload: reloadAll,
          density: true,
          setting: { draggable: true, checkable: true },
          fullScreen: false,
        }}
        toolBarRender={() => {
          const moreItems = [
            { key: 'export', label: '导出' },
            { key: 'dedup', label: '查重' },
            { key: 'recycle', label: '回收站' },
          ];
          return [
            can('crm:customer:create') ? (
              <Button
                key="create"
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                新建客户
              </Button>
            ) : null,
            can('crm:customer:create') ? (
              <Button
                key="import"
                icon={<ImportOutlined />}
                onClick={() => message.info('导入功能开发中（Phase 5）')}
              >
                导入
              </Button>
            ) : null,
            <Dropdown
              key="more"
              menu={{
                items: moreItems,
                onClick: ({ key }) =>
                  message.info(
                    key === 'export'
                      ? '导出功能开发中（Phase 5）'
                      : key === 'dedup'
                        ? '查重功能开发中（Phase 5）'
                        : '回收站功能开发中（Phase 5）',
                  ),
              }}
              trigger={['click']}
            >
              <Button>
                更多
                <DownOutlined />
              </Button>
            </Dropdown>,
          ].filter(Boolean) as any;
        }}
      />

      <CustomerDrawer
        open={drawer.open}
        customerId={drawer.customerId}
        initialTab={drawer.initialTab}
        onClose={drawer.closeDrawer}
        onChanged={reloadAll}
        statuses={statuses}
      />

      {/* 行操作菜单由 CustomerActionDropdown 内部自带 Modal；这里保留引用避免 tree-shake 误删。 */}
      {false && (
        <CustomerActionDropdown
          record={{} as CustomerRow}
          onChanged={() => undefined}
          onOpenDetail={() => undefined}
        />
      )}
    </PageContainer>
  );
};

export default Customers;
