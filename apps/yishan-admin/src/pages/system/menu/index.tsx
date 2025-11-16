import { PlusOutlined } from '@ant-design/icons';
import { ActionType, ProColumns, ProTable } from '@ant-design/pro-components';
import { Button, Form, Popconfirm, Space, Tag, App } from 'antd';
import React, { useRef, useState } from 'react';
import {
  getMenuTree,
  createMenu,
  getMenuDetail,
  updateMenu,
  deleteMenu,
} from '@/services/yishan-admin/sysMenus';
import MenuForm from './components/MenuForm';

const MenuStatus = { ENABLED: 1, DISABLED: 0 } as const;
const MenuType = { DIR: 0, MENU: 1, BUTTON: 2 } as const;

const MenuStatusTag: React.FC<{ status?: 0 | 1 }> = ({ status }) => {
  if (status === MenuStatus.ENABLED) return <Tag color="success">启用</Tag>;
  return <Tag color="error">禁用</Tag>;
};

const MenuTypeTag: React.FC<{ type?: 0 | 1 | 2 }> = ({ type }) => {
  if (type === MenuType.DIR) return <Tag color="blue">目录</Tag>;
  if (type === MenuType.MENU) return <Tag color="processing">菜单</Tag>;
  return <Tag color="purple">按钮</Tag>;
};

const MenuList: React.FC = () => {
  const actionRef = useRef<ActionType>(null);
  const { message } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  const [formOpen, setFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('新建菜单');
  const [currentMenu, setCurrentMenu] = useState<API.sysMenu | undefined>(undefined);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const handleStatusChange = async (id: number, status: number) => {
    try {
      const newStatus = status === MenuStatus.ENABLED ? MenuStatus.DISABLED : MenuStatus.ENABLED;
      await updateMenu({ id: String(id) }, { status: newStatus as 0 | 1 });
      message.success('状态更新成功');
      actionRef.current?.reload();
    } catch {
      message.error('操作失败');
    }
  };

  const handleAdd = () => {
    setFormTitle('新建菜单');
    setCurrentMenu(undefined);
    setFormOpen(true);
  };

  const handleEdit = async (id: number) => {
    try {
      setFormTitle('编辑菜单');
      const result = await getMenuDetail({ id: String(id) });
      if (result.success && result.data) {
        setCurrentMenu(result.data);
        setFormOpen(true);
      }
    } catch {
      message.error('获取菜单详情失败');
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await deleteMenu({ id: String(id) });
      message.success('删除成功');
      actionRef.current?.reload();
    } catch {
      message.error('删除失败');
    }
  };

  const handleBatchRemove = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择要删除的菜单');
      return;
    }
    setBatchDeleteLoading(true);
    try {
      const ids = selectedRowKeys.map((key) => Number(key));
      const deletePromises = ids.map((id) => deleteMenu({ id: String(id) }));
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
    } catch {
      message.error('批量删除失败');
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  const handleFormSubmit = async (values: API.saveMenuReq | API.updateMenuReq) => {
    try {
      setConfirmLoading(true);
      if (currentMenu?.id) {
        const payload: API.updateMenuReq = {
          name: values.name,
          type: values.type,
          parentId: values.parentId,
          path: values.path,
          icon: values.icon,
          component: values.component,
          status: values.status,
          sort_order: values.sort_order,
          hideInMenu: values.hideInMenu,
          isExternalLink: values.isExternalLink,
          perm: values.perm,
          keepAlive: values.keepAlive,
        };
        await updateMenu({ id: String(currentMenu.id) }, payload);
        message.success('菜单更新成功');
      } else {
        await createMenu(values as API.saveMenuReq);
        message.success('菜单创建成功');
      }
      setFormOpen(false);
      actionRef.current?.reload();
    } catch {
      message.error('操作失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const columns: ProColumns<API.menuTreeNode>[] = [
    { title: 'ID', dataIndex: 'id', search: false },
    { title: '菜单名称', dataIndex: 'name', width: 120 },
    { title: '路由地址', dataIndex: 'path', search: false },
    { title: '组件', dataIndex: 'component', search: false },
    { title: '图标', dataIndex: 'icon', search: false },
    {
      title: '状态',
      dataIndex: 'status',
      valueEnum: {
        [MenuStatus.ENABLED]: { text: '启用', status: 'Success' },
        [MenuStatus.DISABLED]: { text: '禁用', status: 'Error' },
      },
      render: (_, record) => <MenuStatusTag status={record.status} />,
    },
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
          {record.status === MenuStatus.ENABLED ? '禁用' : '启用'}
        </a>,
        <Popconfirm key="delete" title="确定要删除该菜单吗？" onConfirm={() => handleRemove(record.id || 0)}>
          <Button className='p-0' type="link" danger>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable<API.menuTreeNode>
        headerTitle="菜单列表"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        pagination={false}
        expandable={{ expandedRowKeys, onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]) }}
        toolBarRender={() => [
          <Button type="primary" key="primary" onClick={handleAdd}>
            <PlusOutlined /> 新建
          </Button>,
        ]}
        request={async () => {
          const result = await getMenuTree();
          const normalize = (nodes: API.menuTreeNode[] | null | undefined): API.menuTreeNode[] => {
            if (!nodes) return [];
            return nodes.map((n) => ({
              ...n,
              children: n.children ? normalize(n.children) : null,
            }));
          };
          const collectIds = (nodes: API.menuTreeNode[] | null | undefined): number[] => {
            if (!nodes) return [];
            const acc: number[] = [];
            const walk = (list: API.menuTreeNode[]) => {
              list.forEach((n) => {
                acc.push(n.id || 0);
                if (Array.isArray(n.children)) {
                  walk(n.children as API.menuTreeNode[]);
                }
              });
            };
            walk(nodes);
            return acc;
          };
          const data = normalize(result.data) || [];
          setExpandedRowKeys(collectIds(data));
          return {
            data,
            success: result.success,
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
        tableAlertOptionRender={() => (
          <Space>
            <Popconfirm title={`确定要删除选中的 ${selectedRowKeys.length} 个菜单吗？`} onConfirm={handleBatchRemove}>
              <Button type="link" danger loading={batchDeleteLoading}>批量删除</Button>
            </Popconfirm>
          </Space>
        )}
      />

      <MenuForm
        form={form}
        open={formOpen}
        title={formTitle}
        initialValues={currentMenu}
        onCancel={() => setFormOpen(false)}
        confirmLoading={confirmLoading}
        onSubmit={handleFormSubmit}
      />
    </>
  );
};

export default MenuList;