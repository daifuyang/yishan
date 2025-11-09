import { PlusOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Form, message, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { 
  getDeptTree,
  createDept,
  getDeptDetail,
  updateDept,
  deleteDept,
} from '@/services/yishan-admin/sysDepts';
import DepartmentForm from './components/DepartmentForm';

type DeptTreeNode = API.deptTreeNode;

const DeptStatus = {
  ENABLED: 1,
  DISABLED: 0,
};

const DeptType = {
  COMPANY: 1,
  DEPARTMENT: 2,
  TEAM: 3,
};

const DeptStatusTag: React.FC<{ status?: number }> = ({ status }) => {
  if (status === DeptStatus.ENABLED) return <Tag color="success">启用</Tag>;
  return <Tag color="error">禁用</Tag>;
};

const DeptTypeTag: React.FC<{ type?: number }> = ({ type }) => {
  if (type === DeptType.COMPANY) return <Tag color="blue">公司</Tag>;
  if (type === DeptType.DEPARTMENT) return <Tag color="processing">部门</Tag>;
  return <Tag color="purple">小组</Tag>;
};

const DepartmentList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('新建部门');
  const [currentDept, setCurrentDept] = useState<API.sysDept | undefined>(undefined);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const handleStatusChange = async (id: number, status: number) => {
    try {
      const newStatus = status === DeptStatus.ENABLED ? DeptStatus.DISABLED : DeptStatus.ENABLED;
      await updateDept(
        { id },
        { status: newStatus as 0 | 1 }
      );
      message.success('状态更新成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleAdd = () => {
    setFormTitle('新建部门');
    setCurrentDept(undefined);
    setFormOpen(true);
  };

  const handleEdit = async (id: number) => {
    try {
      setFormTitle('编辑部门');
      const result = await getDeptDetail({ id });
      if (result.success && result.data) {
        setCurrentDept(result.data);
        setFormOpen(true);
      }
    } catch (error) {
      message.error('获取部门详情失败');
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deleteDept({ id });
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleFormSubmit = async (values: API.createDeptReq) => {
    try {
      setConfirmLoading(true);
      if (currentDept?.id) {
        const payload: API.updateDeptReq = {
          name: values.name,
          parentId: values.parentId === 0 ? undefined : values.parentId,
          status: values.status,
          sort_order: values.sort_order,
          description: values.description,
          leaderId: values.leaderId,
        };
        await updateDept(
          { id: currentDept.id },
          payload
        );
        message.success('部门更新成功');
      } else {
        await createDept({
          ...values,
          parentId: values.parentId === 0 ? undefined : values.parentId,
        });
        message.success('部门创建成功');
      }
      setFormOpen(false);
      actionRef.current?.reload();
    } catch (error) {
      message.error('操作失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的部门');
      return;
    }
    setBatchDeleteLoading(true);
    try {
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
    } catch (error) {
      message.error('批量删除失败');
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  const collectExpandKeys = (nodes: DeptTreeNode[] = []): React.Key[] => {
    const keys: React.Key[] = [];
    const dfs = (arr: DeptTreeNode[]) => {
      arr.forEach((n) => {
        if (n.children && n.children.length) {
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
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        [DeptStatus.ENABLED]: { text: '启用', status: 'Success' },
        [DeptStatus.DISABLED]: { text: '禁用', status: 'Error' },
      },
      render: (_, record) => <DeptStatusTag status={record.status} />,
    },
    { title: '上级部门', dataIndex: 'parentName', search: false },
    { title: '负责人', dataIndex: 'leaderName', search: false },
    { title: '排序', dataIndex: 'sort_order', search: false },
    { title: '创建时间', dataIndex: 'createdAt', search: false, valueType: 'dateTime' },
    { title: '更新时间', dataIndex: 'updatedAt', search: false, valueType: 'dateTime' },
    {
      title: '操作',
      dataIndex: 'option',
      valueType: 'option',
      render: (_, record) => [
        <a key="edit" onClick={() => handleEdit(record.id || 0)}>编辑</a>,
        <a key="status" onClick={() => handleStatusChange(record.id || 0, record.status || 0)}>
          {record.status === DeptStatus.ENABLED ? '禁用' : '启用'}
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
    <>
      <ProTable<DeptTreeNode>
        headerTitle="部门树"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <Button type="primary" key="primary" onClick={handleAdd}>
            <PlusOutlined /> 新建
          </Button>,
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

      <DepartmentForm
        form={form}
        open={formOpen}
        title={formTitle}
        initialValues={currentDept}
        onCancel={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
        confirmLoading={confirmLoading}
      />
    </>
  );
};

export default DepartmentList;