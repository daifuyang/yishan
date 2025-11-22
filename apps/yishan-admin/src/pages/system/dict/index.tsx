import { PlusOutlined, DownOutlined } from '@ant-design/icons';
import { type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Popconfirm, Space, Tag, Dropdown, App } from 'antd';
import React, { useRef, useState } from 'react';
import { getDictTypeList, updateDictType, deleteDictType } from '@/services/yishan-admin/sysDictTypes';
import DictTypeForm from './components/DictTypeForm';
import DictDataManager from './components/DictDataManager';

const Status = { ENABLED: 1, DISABLED: 0 } as const;

const DictTypeList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const [dataOpen, setDataOpen] = useState(false);
  const [dataTypeId, setDataTypeId] = useState<number | undefined>(undefined);
  const [dataTypeKey, setDataTypeKey] = useState<string | undefined>(undefined);
  const [dataTypeName, setDataTypeName] = useState<string | undefined>(undefined);

  const openDataManager = (record: API.sysDictType) => {
    setDataTypeId(record.id);
    setDataTypeKey(record.type);
    setDataTypeName(record.name);
    setDataOpen(true);
  };

  const handleStatusChange = async (id: number, status: number) => {
    const newStatus = status === Status.ENABLED ? Status.DISABLED : Status.ENABLED;
    const res = await updateDictType({ id }, { status: newStatus as 0 | 1 });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deleteDictType({ id });
    if (res.success) message.success(res.message);
    actionRef.current?.reload();
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的字典类型');
      return;
    }
    setBatchDeleteLoading(true);
    const ids = selectedRowKeys.map((key) => Number(key));
    const ps = ids.map((id) => deleteDictType({ id }));
    const results = await Promise.allSettled(ps);
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;
    if (successCount > 0) message.success(`批量删除完成：成功 ${successCount}，失败 ${failureCount}`);
    else message.error('批量删除失败');
    setSelectedRowKeys([]);
    setBatchDeleteLoading(false);
    actionRef.current?.reload();
  };



  const columns: ProColumns<API.sysDictType>[] = [
    { title: '字典编号', dataIndex: 'id', search: false },
    { title: '字典名称', dataIndex: 'name' },
    {
      title: '字典类型',
      dataIndex: 'type',
      render: (_, record) => (
        <a onClick={() => openDataManager(record)}>{record.type}</a>
      ),
    },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', search: false, valueType: 'dateTime' },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        [Status.ENABLED]: { text: '正常', status: 'Success' },
        [Status.DISABLED]: { text: '停用', status: 'Error' },
      },
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => {
        const moreItems = [
          {
            key: 'status',
            label: (
              <a onClick={() => handleStatusChange(record.id || 0, record.status || 0)}>
                {record.status === Status.ENABLED ? '停用' : '启用'}
              </a>
            ),
          },
          {
            key: 'data',
            label: (
              <a onClick={() => openDataManager(record)}>查看字典数据</a>
            ),
          },
        ];
        return [
          <DictTypeForm
            key="edit"
            title="编辑字典类型"
            trigger={<a>修改</a>}
            initialValues={record}
            onFinish={handleFormSuccess}
          />,
          <Popconfirm key="delete" title="确定要删除该字典类型吗？" onConfirm={() => handleRemove(record.id || 0)}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>,
          <Dropdown key="more" menu={{ items: moreItems }}>
            <a onClick={(e) => e.preventDefault()}>
              更多 <DownOutlined />
            </a>
          </Dropdown>,
        ];
      },
    },
  ];

  return (
    <>
      <ProTable<API.sysDictType>
        headerTitle="字典类型列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <DictTypeForm
            key="create"
            title="新建字典类型"
            trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
            onFinish={handleFormSuccess}
          />,
        ]}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const result = await getDictTypeList({ page: current, pageSize, ...rest });
          return {
            data: result.data || [],
            success: result.success,
            total: result.pagination?.total || 0,
          };
        }}
        columns={columns}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
        tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
          <Space size={24}>
            <span>
              已选 {selectedRowKeys.length} 项
              <a style={{ marginLeft: 8 }} onClick={onCleanSelected}>取消选择</a>
            </span>
          </Space>
        )}
        tableAlertOptionRender={() => (
          <Space size={16}>
            <Popconfirm
              placement="bottomRight"
              title="确定要批量删除选中的类型吗？"
              onConfirm={handleBatchDelete}
              okText="确定"
              cancelText="取消"
              disabled={selectedRowKeys.length === 0 || batchDeleteLoading}
            >
              <a style={{
                color: selectedRowKeys.length === 0 || batchDeleteLoading ? '#ccc' : '#ff4d4f',
                cursor: selectedRowKeys.length === 0 || batchDeleteLoading ? 'not-allowed' : 'pointer'
              }}>
                {batchDeleteLoading ? '删除中...' : '批量删除'}
              </a>
            </Popconfirm>
          </Space>
        )}
      />
      <DictDataManager
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        typeId={dataTypeId}
        typeKey={dataTypeKey}
        typeName={dataTypeName}
      />
    </>
  );
};

export default DictTypeList;
