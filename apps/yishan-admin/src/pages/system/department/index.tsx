import { PlusOutlined } from '@ant-design/icons';
import { type ActionType, type ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, message, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { getDeptTree, updateDept, deleteDept } from '@/services/yishan-admin/sysDepts';
import DepartmentForm from './components/DepartmentForm';
import { useModel } from '@umijs/max';

type DeptTreeNode = API.deptTreeNode;

const DeptStatus = {
  ENABLED: "1",
  DISABLED: "0",
} as const;

const DepartmentList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const handleStatusChange = async (id: number, status: "0" | "1") => {
    const newStatus = status === DeptStatus.ENABLED ? DeptStatus.DISABLED : DeptStatus.ENABLED;
    const res = await updateDept(
      { id },
      { status: newStatus as "0" | "1" }
    );
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };

  const handleFormSuccess = async () => {
    actionRef.current?.reload();
  };

  const handleRemove = async (id: number) => {
    const res = await deleteDept({ id });
    if (res.success) {
      message.success(res.message);
    }
    actionRef.current?.reload();
  };



  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的部门');
      return;
    }
    setBatchDeleteLoading(true);
    const ids = selectedRowKeys.map((key) => Number(key));
    const deletePromises = ids.map((id) => deleteDept({ id }));
    const results = await Promise.allSettled(deletePromises);

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    if (successCount > 0) {
      message.success(`批量删除完成：成功 ${successCount}，失败 ${failureCount}`);
    } else {
      message.error('批量删除失败');
    }

    actionRef.current?.reload();
    setSelectedRowKeys([]);
    setBatchDeleteLoading(false);
  };

  const collectExpandKeys = (nodes: DeptTreeNode[] = []): React.Key[] => {
    const keys: React.Key[] = [];
    const dfs = (arr: DeptTreeNode[]) => {
      arr.forEach((n) => {
        if (n.children?.length) {
          keys.push(n.id as React.Key);
          dfs(n.children);
        }
      });
    };
    dfs(nodes);
    return keys;
  };

  const columns: ProColumns<DeptTreeNode>[] = [
    { title: 'ID', dataIndex: 'id', search: false },
    { title: '部门名称', dataIndex: 'name' },
    { title: '上级部门', dataIndex: 'parentName', search: false },
    { title: '负责人', dataIndex: 'leaderName', search: false },
    { title: '排序', dataIndex: 'sort_order', search: false },
    { title: '创建时间', dataIndex: 'createdAt', search: false, valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, valueType: 'dateTime' },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: defaultStatusDict.reduce((acc: Record<string, { text: string; status: string }>, item) => {
        acc[item.value] = {
          text: item.label,
          status: item.value === '1' ? 'Success' : 'Error',
        };
        return acc;
      }, {} as Record<string, { text: string; status: string }>),
    },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => [
        <DepartmentForm
          key="edit"
          title="编辑部门"
          trigger={<a>编辑</a>}
          initialValues={record}
          onFinish={handleFormSuccess}
        />,
        <a key="status" onClick={() => handleStatusChange(record.id || 0, (record.status || '0'))}>
          {record.status === DeptStatus.ENABLED
            ? (defaultStatusDict.find(item => item.value === '0')?.label || '禁用')
            : (defaultStatusDict.find(item => item.value === '1')?.label || '启用')}
        </a>,
        <Popconfirm key="delete" title="确定要删除该部门吗？" onConfirm={() => handleRemove(record.id || 0)}>
          <Button className='p-0' type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <ProTable<DeptTreeNode>
      headerTitle="部门树"
      actionRef={actionRef}
      rowKey="id"
      search={{ labelWidth: 120 }}
      toolBarRender={() => [
        <DepartmentForm
          key="create"
          title="新建部门"
          trigger={
            <Button type="primary">
              <PlusOutlined /> 新建
            </Button>
          }
          onFinish={handleFormSuccess}
        />,
      ]}
      request={async () => {
        const result = await getDeptTree();
        const treeData: DeptTreeNode[] = result.data || [];
        // 控制展开：接口数据到达后，收集所有父节点并设置为展开
        setExpandedRowKeys(collectExpandKeys(treeData));
        return {
          data: treeData,
          success: result.success,
        };
      }}
      pagination={false}
      expandable={{
        expandedRowKeys,
        onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
      }}
      columns={columns}
      rowSelection={{
        selectedRowKeys,
        onChange: (keys: React.Key[], _rows: DeptTreeNode[]) => setSelectedRowKeys(keys),
      }}
      tableAlertRender={({ selectedRowKeys, onCleanSelected }) => (
        <Space size={24}>
          <span>
            已选 {selectedRowKeys.length} 项
            <a style={{ marginLeft: 8 }} onClick={onCleanSelected}>
              取消选择
            </a>
          </span>
        </Space>
      )}
      tableAlertOptionRender={() => {
        return (
          <Space>
            <Popconfirm
              title={`确定要删除选中的 ${selectedRowKeys.length} 个部门吗？`}
              onConfirm={handleBatchRemove}
              disabled={selectedRowKeys.length === 0 || batchDeleteLoading}
            >
              <Button className='p-0' type="link" danger disabled={selectedRowKeys.length === 0 || batchDeleteLoading}>
                {batchDeleteLoading ? '删除中...' : '批量删除'}
              </Button>
            </Popconfirm>
            <Button className='p-0' type="link" onClick={() => message.info('暂未实现')}>
              批量导出
            </Button>
          </Space>
        );
      }}
    />
  );
};

export default DepartmentList;
