import {
  type ActionType,
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Modal,
  message,
  Select,
  Space,
  Tag,
} from 'antd';
import React, { useRef, useState } from 'react';
import {
  disablePlugin,
  enablePlugin,
  getPluginHookReports,
  getSyncLogs,
  listPlugins,
  type SysPlugin,
  type SysPluginHookReport,
  type SysPluginSyncLog,
  syncPlugin,
} from '@/services/yishan-admin/sysPlugins';

const SYNC_STATUS_COLOR: Record<string, string> = {
  success: 'green',
  partial: 'orange',
  failed: 'red',
};

const SYNC_STATUS_TEXT: Record<string, string> = {
  success: '成功',
  partial: '部分成功',
  failed: '失败',
};

const PluginList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [hookReports, setHookReports] = useState<SysPluginHookReport[]>([]);
  const [syncDrawerOpen, setSyncDrawerOpen] = useState(false);
  const [syncLogs, setSyncLogs] = useState<SysPluginSyncLog[]>([]);
  const [syncLogsLoading, setSyncLogsLoading] = useState(false);
  const [currentPlugin, setCurrentPlugin] = useState<SysPlugin | null>(null);
  const [enableModalOpen, setEnableModalOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'strict' | 'safe'>(
    'safe',
  );
  const [enabling, setEnabling] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStrategy, setSyncStrategy] = useState<'strict' | 'safe'>('safe');

  const handleEnable = async () => {
    if (!currentPlugin) return;
    setEnabling(true);
    const res = await enablePlugin(currentPlugin.name, selectedStrategy);
    setEnabling(false);
    setEnableModalOpen(false);
    if (res.success) {
      message.success('启用成功，请刷新页面查看菜单变化');
      actionRef.current?.reload();
      return;
    }
    message.error(res.message || '启用失败');
  };

  const handleOpenEnableModal = (plugin: SysPlugin) => {
    setCurrentPlugin(plugin);
    setSelectedStrategy('safe');
    setEnableModalOpen(true);
  };

  const handleOpenSyncModal = (plugin: SysPlugin) => {
    setCurrentPlugin(plugin);
    setSyncStrategy('safe');
    setSyncModalOpen(true);
  };

  const handleSync = async () => {
    if (!currentPlugin?.name) return;
    setSyncing(true);
    const res = await syncPlugin(currentPlugin.name, syncStrategy);
    setSyncing(false);
    setSyncModalOpen(false);
    if (res.success) {
      message.success('同步成功，请刷新页面查看菜单变化');
      actionRef.current?.reload();
      return;
    }
    message.error(res.message || '同步失败');
  };

  const handleDisable = async (name?: string) => {
    if (!name) return;
    const res = await disablePlugin(name);
    if (res.success) {
      message.success('停用成功，请刷新页面查看菜单变化');
      actionRef.current?.reload();
      return;
    }
    message.error(res.message || '停用失败');
  };

  const handleOpenReports = async () => {
    setReportDrawerOpen(true);
    setReportsLoading(true);
    const res = await getPluginHookReports({ limit: 50 });
    setReportsLoading(false);
    if (res.success) {
      setHookReports(res.data || []);
      return;
    }
    setHookReports([]);
    message.error(res.message || '获取 hooks reports 失败');
  };

  const handleOpenSyncLogs = async (plugin: SysPlugin) => {
    setCurrentPlugin({ name: plugin.name, pluginId: plugin.pluginId });
    setSyncDrawerOpen(true);
    setSyncLogsLoading(true);
    const res = await getSyncLogs(plugin.name, 10);
    setSyncLogsLoading(false);
    if (res.success) {
      setSyncLogs(res.data || []);
      return;
    }
    setSyncLogs([]);
    message.error(res.message || '获取同步记录失败');
  };

  const columns: ProColumns<SysPlugin>[] = [
    { title: '插件ID', dataIndex: 'pluginId', search: false, width: 180 },
    { title: '插件名', dataIndex: 'name' },
    { title: '版本', dataIndex: 'version', search: false, width: 120 },
    {
      title: '状态',
      dataIndex: 'state',
      search: false,
      width: 120,
      render: (_, record) => (
        <Tag
          color={
            record.state === 'error'
              ? 'red'
              : record.enabled
                ? 'green'
                : 'default'
          }
        >
          {record.state || (record.enabled ? 'enabled' : 'disabled')}
        </Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      search: false,
      width: 100,
      render: (_, record) => (
        <Tag color={record.enabled ? 'success' : 'default'}>
          {record.enabled ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '同步状态',
      dataIndex: 'syncStatus',
      search: false,
      width: 180,
      render: (_, record) => {
        if (!record.syncStatus) return <Tag>未同步</Tag>;
        return (
          <Space>
            <Tag
              color={SYNC_STATUS_COLOR[record.syncStatus.status] || 'default'}
            >
              {SYNC_STATUS_TEXT[record.syncStatus.status] ||
                record.syncStatus.status}
            </Tag>
            {record.syncStatus.conflicted > 0 && (
              <Tag color="orange">冲突{record.syncStatus.conflicted}</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '兼容版本',
      dataIndex: 'coreCompatibility',
      search: false,
      width: 140,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      search: false,
      valueType: 'dateTime',
      width: 180,
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size={16}>
          <a onClick={() => handleOpenSyncLogs(record)}>同步记录</a>
          <a onClick={() => handleOpenSyncModal(record)}>同步</a>
          {record.enabled ? (
            <a onClick={() => handleDisable(record.name)}>停用</a>
          ) : (
            <a onClick={() => handleOpenEnableModal(record)}>启用</a>
          )}
        </Space>
      ),
    },
  ];

  const syncLogColumns: ProColumns<SysPluginSyncLog>[] = [
    { title: '策略', dataIndex: 'strategy', search: false, width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      search: false,
      width: 100,
      render: (val) => {
        const strVal = String(val ?? '');
        return (
          <Tag color={SYNC_STATUS_COLOR[strVal] || 'default'}>
            {SYNC_STATUS_TEXT[strVal] || strVal}
          </Tag>
        );
      },
    },
    { title: '新增', dataIndex: 'created', search: false, width: 90 },
    { title: '更新', dataIndex: 'updated', search: false, width: 90 },
    { title: '跳过', dataIndex: 'skipped', search: false, width: 90 },
    {
      title: '冲突',
      dataIndex: 'conflicted',
      search: false,
      width: 90,
      render: (val) => {
        const numVal = Number(val);
        return numVal > 0 ? (
          <span style={{ color: 'orange' }}>{numVal}</span>
        ) : (
          numVal
        );
      },
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      search: false,
      valueType: 'dateTime',
      width: 180,
    },
  ];

  return (
    <PageContainer>
      <ProTable<SysPlugin>
        headerTitle="插件管理"
        actionRef={actionRef}
        rowKey={(record) => record.pluginId || record.name}
        search={false}
        columns={columns}
        request={async () => {
          const result = await listPlugins();
          return {
            data: result.data || [],
            success: result.success,
            total: (result.data || []).length,
          };
        }}
        toolBarRender={() => [
          <Button key="reports" onClick={handleOpenReports}>
            Hooks Reports
          </Button>,
        ]}
        scroll={{ x: 1380 }}
      />

      <Modal
        title={`启用插件: ${currentPlugin?.name}`}
        open={enableModalOpen}
        onOk={handleEnable}
        onCancel={() => setEnableModalOpen(false)}
        confirmLoading={enabling}
      >
        <Descriptions column={1}>
          <Descriptions.Item label="插件名">
            {currentPlugin?.name}
          </Descriptions.Item>
          <Descriptions.Item label="版本">
            {currentPlugin?.version}
          </Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="sync-strategy-select">同步策略：</label>
          <Select
            id="sync-strategy-select"
            value={selectedStrategy}
            onChange={setSelectedStrategy}
            style={{ width: 200, marginLeft: 8 }}
          >
            <Select.Option value="safe">safe（冲突跳过，有告警）</Select.Option>
            <Select.Option value="strict">
              strict（冲突即失败，状态标 error）
            </Select.Option>
          </Select>
        </div>
        {selectedStrategy === 'strict' && (
          <Alert
            message="strict 模式说明"
            description="启用时若存在路径冲突，插件将被标记为 error 状态，无法正常使用。请确保该插件菜单路径与现有菜单不冲突。"
            type="warning"
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>

      <Modal
        title={`同步插件菜单: ${currentPlugin?.name}`}
        open={syncModalOpen}
        onOk={handleSync}
        onCancel={() => setSyncModalOpen(false)}
        confirmLoading={syncing}
      >
        <Descriptions column={1}>
          <Descriptions.Item label="插件名">
            {currentPlugin?.name}
          </Descriptions.Item>
          <Descriptions.Item label="版本">
            {currentPlugin?.version}
          </Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 16 }}>
          <label htmlFor="manual-sync-strategy-select">同步策略：</label>
          <Select
            id="manual-sync-strategy-select"
            value={syncStrategy}
            onChange={setSyncStrategy}
            style={{ width: 240, marginLeft: 8 }}
          >
            <Select.Option value="safe">safe（冲突跳过，有告警）</Select.Option>
            <Select.Option value="strict">strict（冲突即失败）</Select.Option>
          </Select>
        </div>
        {syncStrategy === 'strict' && (
          <Alert
            message="strict 模式说明"
            description="同步时若存在路径冲突，将直接失败。请先解决冲突后再重试。"
            type="warning"
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>

      <Drawer
        title="Hooks Reports"
        width={900}
        open={reportDrawerOpen}
        onClose={() => setReportDrawerOpen(false)}
      >
        <ProTable<SysPluginHookReport>
          rowKey={(row) =>
            `${row.id || ''}-${row.pluginName || ''}-${row.hookName || ''}-${row.createdAt || ''}`
          }
          loading={reportsLoading}
          search={false}
          options={false}
          pagination={{ pageSize: 10 }}
          dataSource={hookReports}
          columns={[
            { title: '插件', dataIndex: 'pluginName', width: 140 },
            { title: 'Hook', dataIndex: 'hookName', width: 160 },
            { title: '状态', dataIndex: 'status', width: 100 },
            { title: '信息', dataIndex: 'message', ellipsis: true, width: 300 },
            {
              title: '时间',
              dataIndex: 'createdAt',
              valueType: 'dateTime',
              width: 180,
            },
          ]}
          scroll={{ x: 1100 }}
          toolBarRender={() => [
            <Space key="drawer-actions">
              <Button onClick={handleOpenReports}>刷新</Button>
            </Space>,
          ]}
        />
      </Drawer>

      <Drawer
        title={`同步记录: ${currentPlugin?.name}`}
        width={900}
        open={syncDrawerOpen}
        onClose={() => setSyncDrawerOpen(false)}
      >
        {currentPlugin?.syncStatus && (
          <Alert
            message="最近一次同步"
            description={
              <div>
                <p>
                  策略: {currentPlugin.syncStatus.strategy} | 状态:{' '}
                  {SYNC_STATUS_TEXT[currentPlugin.syncStatus.status]}
                </p>
                <p>
                  新增: {currentPlugin.syncStatus.created} | 更新:{' '}
                  {currentPlugin.syncStatus.updated} | 跳过:{' '}
                  {currentPlugin.syncStatus.skipped} | 冲突:{' '}
                  {currentPlugin.syncStatus.conflicted}
                </p>
                {currentPlugin.syncStatus.conflicted > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <strong>冲突详情：</strong>
                    <ul>
                      {currentPlugin.syncStatus.conflictDetails.map((c) => (
                        <li key={c.path}>
                          路径 {c.path} 被 {c.existingPluginName} 占用 (
                          {c.reason})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            }
            type={
              currentPlugin.syncStatus.status === 'failed'
                ? 'error'
                : currentPlugin.syncStatus.conflicted > 0
                  ? 'warning'
                  : 'success'
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <ProTable<SysPluginSyncLog>
          rowKey="id"
          loading={syncLogsLoading}
          search={false}
          options={false}
          pagination={{ pageSize: 10 }}
          dataSource={syncLogs}
          columns={syncLogColumns}
          scroll={{ x: 900 }}
          toolBarRender={() => [
            <Space key="sync-actions">
              <Button
                onClick={() =>
                  currentPlugin && handleOpenSyncLogs(currentPlugin)
                }
              >
                刷新
              </Button>
            </Space>,
          ]}
        />
      </Drawer>
    </PageContainer>
  );
};

export default PluginList;
