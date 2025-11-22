import React, { useMemo, useRef, useState } from 'react';
import { Drawer, Popconfirm, Space, Tag, Button } from 'antd';
import { type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { PlusOutlined } from '@ant-design/icons';
import { getDictDataList, updateDictData, deleteDictData } from '@/services/yishan-admin/sysDictData';
import DictDataForm from './DictDataForm';

export interface DictDataManagerProps {
  open: boolean;
  onClose: () => void;
  typeId?: number;
  typeKey?: string;
  typeName?: string;
}

const Status = { ENABLED: 1, DISABLED: 0 } as const;

const DictDataManager: React.FC<DictDataManagerProps> = ({ open, onClose, typeId, typeKey, typeName }) => {
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const typeLabel = useMemo(() => typeName || typeKey || `类型ID: ${typeId ?? '-'}`, [typeId, typeKey, typeName]);

  const handleStatusChange = async (id: number, status: number) => {
    const newStatus = status === Status.ENABLED ? Status.DISABLED : Status.ENABLED;
    await updateDictData({ id }, { status: newStatus as 0 | 1 });
    actionRef.current?.reload();
  };

  const handleDefaultToggle = async (id: number, isDefault: boolean) => {
    await updateDictData({ id }, { isDefault: !isDefault });
    actionRef.current?.reload();
  };



  const handleRemove = async (id: number) => {
    await deleteDictData({ id });
    actionRef.current?.reload();
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) return;
    setBatchDeleteLoading(true);
    const ids = selectedRowKeys.map((key) => Number(key));
    const ps = ids.map((id) => deleteDictData({ id }));
    await Promise.allSettled(ps);
    setSelectedRowKeys([]);
    setBatchDeleteLoading(false);
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<API.sysDictData>[] = [
    { title: '字典编号', dataIndex: 'id', search: false },
    { title: '字典标签', dataIndex: 'label' },
    { title: '字典键值', dataIndex: 'value' },
    { title: '字典排序', dataIndex: 'sort_order', search: false },
    { title: '备注', dataIndex: 'remark', search: false, ellipsis: true },
    {
      title: '默认状态',
      dataIndex: 'isDefault',
      valueEnum: {
        true: { text: '默认' },
        false: { text: '否' },
      },
      search: false,
    },
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
      width: 180,
      render: (_, record) => [
        <DictDataForm
          key="edit"
          title="编辑字典数据"
          trigger={<a>修改</a>}
          typeId={Number(typeId || 0)}
          initialValues={record}
          onFinish={handleFormSuccess}
        />,
        <Popconfirm key="delete" title="确定要删除该字典数据吗？" onConfirm={() => handleRemove(record.id || 0)}>
          <a style={{ color: '#ff4d4f' }}>删除</a>
        </Popconfirm>,
        <a key="status" onClick={() => handleStatusChange(record.id || 0, record.status || 0)}>
          {record.status === Status.ENABLED ? '停用' : '启用'}
        </a>,
        <a key="default" onClick={() => handleDefaultToggle(record.id || 0, !!record.isDefault)}>
          {record.isDefault ? '取消默认' : '设为默认'}
        </a>,
      ],
    },
  ];

  return (
    <Drawer
      width={'80%'}
      title={`字典数据：${typeLabel}`}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <ProTable<API.sysDictData>
        headerTitle="字典数据列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <DictDataForm
            key="create"
            title="新建字典数据"
            trigger={<Button type="primary"><PlusOutlined /> 新建</Button>}
            typeId={Number(typeId || 0)}
            onFinish={handleFormSuccess}
          />
        ]}
        request={async (params) => {
          const { current, pageSize, ...rest } = params;
          const q = typeId ? { typeId } : { type: typeKey };
          const result = await getDictDataList({ page: current, pageSize, ...q, ...rest });
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
          <Space>
            <Popconfirm title={`确定要删除选中的 ${selectedRowKeys.length} 条数据吗？`} onConfirm={handleBatchDelete}>
              <Button className='p-0' type="link" danger loading={batchDeleteLoading}>批量删除</Button>
            </Popconfirm>
          </Space>
        )}
      />


    </Drawer>
  );
};

export default DictDataManager;
