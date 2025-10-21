import { PlusOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Form, message, Popconfirm, Space, Tag } from 'antd';
import React, { useRef, useState } from 'react';
import { 
  getDepartmentList,
  createDepartment,
  getAdminDepartmentsId,
  putAdminDepartmentsId,
  putAdminDepartmentsIdStatus,
  deleteAdminDepartmentsId,
  batchDeleteDepartments,
} from '@/services/yishan-admin/sysDepartments';
import DepartmentForm from './components/DepartmentForm';

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
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('新建部门');
  const [currentDept, setCurrentDept] = useState<API.sysDepartment | undefined>(undefined);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const handleStatusChange = async (id: number, status: number) => {
    try {
      const newStatus = status === DeptStatus.ENABLED ? DeptStatus.DISABLED : DeptStatus.ENABLED;
      await putAdminDepartmentsIdStatus(
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
      const result = await getAdminDepartmentsId({ id });
      const data = (result as any).data; // service response may not have success flag
      const department = (data && (data as any).data) ? (data as any).data : result.data;
      if (department) {
        setCurrentDept(department);
        setFormOpen(true);
      }
    } catch (error) {
      message.error('获取部门详情失败');
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deleteAdminDepartmentsId({ id });
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleFormSubmit = async (values: API.sysDepartmentCreateRequest) => {
    try {
      setConfirmLoading(true);
      if (currentDept?.id) {
        await putAdminDepartmentsId(
          { id: currentDept.id },
          values
        );
        message.success('部门更新成功');
      } else {
        await createDepartment(values);
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
      const res = await batchDeleteDepartments({ deptIds: ids });
      const successCount = res.data?.successCount || 0;
      const failureCount = res.data?.failureCount || 0;

      if (successCount > 0) {
        message.success(`批量删除完成：成功 ${successCount}，失败 ${failureCount}`);
      } else {
        message.error('批量删除失败');
      }

      if (failureCount > 0 && res.data?.details?.length) {
        const failed = res.data.details.filter((d) => d.success === false);
        const tip = failed.map((f) => `ID ${f.id}: ${f.message}`).join('\n');
        if (tip) {
          message.warning(tip);
        }
      }

      actionRef.current?.reload();
      setSelectedRowKeys([]);
    } catch (error) {
      message.error('批量删除失败');
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  const columns: ProColumns<API.sysDepartment>[] = [
    { title: 'ID', dataIndex: 'id', search: false },
    { title: '部门名称', dataIndex: 'deptName' },
    {
      title: '类型',
      dataIndex: 'deptType',
      valueEnum: {
        [DeptType.COMPANY]: { text: '公司', status: 'Default' },
        [DeptType.DEPARTMENT]: { text: '部门', status: 'Processing' },
        [DeptType.TEAM]: { text: '小组', status: 'Success' },
      },
      render: (_, record) => <DeptTypeTag type={record.deptType} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        [DeptStatus.ENABLED]: { text: '启用', status: 'Success' },
        [DeptStatus.DISABLED]: { text: '禁用', status: 'Error' },
      },
      render: (_, record) => <DeptStatusTag status={record.status} />,
    },
    { title: '负责人', dataIndex: 'leaderName', search: false },
    { title: '电话', dataIndex: 'phone', search: false },
    { title: '邮箱', dataIndex: 'email', search: false },
    { title: '排序', dataIndex: 'sortOrder', search: false },
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
      <ProTable<API.sysDepartment>
        headerTitle="部门列表"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 120 }}
        toolBarRender={() => [
          <Button type="primary" key="primary" onClick={handleAdd}>
            <PlusOutlined /> 新建
          </Button>,
        ]}
        request={async (params) => {
          const { current, pageSize, ...restParams } = params;
          const result = await getDepartmentList({
            page: current,
            pageSize,
            ...restParams,
          });
          return {
            data: result.data?.list || [],
            success: (result as any).success ?? true,
            total: result.data?.pagination?.total || 0,
          };
        }}
        columns={columns}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
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