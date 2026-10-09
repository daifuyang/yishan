import { CheckOutlined, PlusOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import type { MenuProps } from 'antd';
import {
  Button,
  Dropdown,
  Empty,
  message,
  Popconfirm,
  Skeleton,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { statusOf, TASK_STATUSES } from '@/modules/crm/domain/statuses';
import {
  type CustomerDetail,
  completeTask,
  deleteTask,
  listTasks,
  TASK_PRIORITY_OPTIONS,
  type TaskRow,
} from '@/services/crm';
import { getUserList } from '@yishan/core-system-admin/services/sysUsers';
import { usePermission } from '@/utils/permission';
import TaskCreateModal from './TaskCreateModal';

const { Text } = Typography;

const priorityTag = (value: string) => {
  const found = TASK_PRIORITY_OPTIONS.find((p) => p.value === value);
  if (!found) return <Tag>{value}</Tag>;
  return (
    <Tag color={found.semantic === 'default' ? undefined : found.semantic}>
      {found.label}
    </Tag>
  );
};

const statusTag = (row: TaskRow) => {
  const s = statusOf(row.status, TASK_STATUSES);
  const isOverdue =
    row.status === 'todo' && row.dueAt && dayjs(row.dueAt).isBefore(dayjs());
  return (
    <Tag
      color={
        isOverdue
          ? 'warning'
          : s.semantic === 'default'
            ? undefined
            : s.semantic
      }
    >
      {isOverdue ? '已逾期' : s.label}
    </Tag>
  );
};

const dueAtText = (value: string | null) => {
  if (!value) return '—';
  const d = dayjs(value);
  const now = dayjs();
  const time = d.format('HH:mm');
  if (d.isSame(now, 'day')) return `今天 ${time}`;
  if (d.isSame(now.add(1, 'day'), 'day')) return `明天 ${time}`;
  if (d.year() === now.year()) return d.format('MM-DD HH:mm');
  return d.format('YYYY-MM-DD HH:mm');
};

export interface TasksTabProps {
  customer: CustomerDetail;
  refreshKey: number;
  /** 「+ 新建任务」按钮回调 —— 由父级（CustomerDrawer）控制 Modal 打开。 */
  onCreateRequest?: () => void;
  /** 当前登录用户 id（默认负责人显示「我」）。 */
  currentUserId?: number;
}

export default function TasksTab({
  customer,
  refreshKey,
  onCreateRequest,
  currentUserId,
}: TasksTabProps) {
  const can = usePermission();
  const canCreate = can('crm:task:create');
  const canUpdate = can('crm:task:update');
  const canDelete = can('crm:task:delete');

  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await listTasks({
        customerId: customer.id,
        page: 1,
        pageSize: 100,
      });
      setRows(r.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id, refreshKey]);

  const handleComplete = async (id: number) => {
    try {
      await completeTask(id);
      message.success('任务已完成');
      await reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTask(id);
      message.success('任务已删除');
      await reload();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    }
  };

  const columns: ProColumns<TaskRow>[] = useMemo(
    () => [
      {
        title: '任务',
        dataIndex: 'title',
        ellipsis: true,
        width: 280,
      },
      {
        title: '截止时间',
        dataIndex: 'dueAt',
        width: 140,
        render: (_, row) => (
          <Text
            type={
              row.status === 'todo' &&
              row.dueAt &&
              dayjs(row.dueAt).isBefore(dayjs())
                ? 'warning'
                : undefined
            }
          >
            {dueAtText(row.dueAt)}
          </Text>
        ),
      },
      {
        title: '负责人',
        dataIndex: 'assigneeName',
        width: 100,
        renderText: (value, row) => {
          if (value) return value;
          if (currentUserId && row.assigneeUserId === currentUserId)
            return '我';
          return row.assigneeUserId ? `用户 #${row.assigneeUserId}` : '—';
        },
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        width: 80,
        render: (_, row) => priorityTag(row.priority),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 90,
        render: (_, row) => statusTag(row),
      },
      {
        title: '操作',
        dataIndex: 'option',
        valueType: 'option',
        fixed: 'right',
        width: 140,
        render: (_, row) => {
          const menuItems: NonNullable<MenuProps['items']> = [];
          if (canUpdate && row.status !== 'completed') {
            menuItems.push({
              key: 'complete',
              icon: <CheckOutlined />,
              label: (
                <Popconfirm
                  title={`确认完成任务「${row.title}」？`}
                  okText="完成"
                  cancelText="取消"
                  onConfirm={(e) => {
                    e?.stopPropagation?.();
                    void handleComplete(row.id);
                  }}
                >
                  <span>完成</span>
                </Popconfirm>
              ),
            });
          }
          if (canDelete) {
            menuItems.push({
              key: 'delete',
              label: (
                <Popconfirm
                  title={`确认删除任务「${row.title}」？`}
                  okText="删除"
                  okButtonProps={{ danger: true }}
                  cancelText="取消"
                  onConfirm={(e) => {
                    e?.stopPropagation?.();
                    void handleDelete(row.id);
                  }}
                >
                  <span style={{ color: '#ff4d4f' }}>删除</span>
                </Popconfirm>
              ),
            });
          }
          if (menuItems.length === 0) return null;
          return (
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button type="text" size="small">
                ···
              </Button>
            </Dropdown>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canUpdate, canDelete, currentUserId],
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 40,
          marginBottom: rows.length ? 8 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>任务</span>
          <span style={{ fontSize: 13, marginTop: 2 }}>
            {rows.filter((r) => r.status === 'todo').length > 0 ? (
              <Tooltip title="待处理任务数">
                <Text type="secondary">
                  {rows.filter((r) => r.status === 'todo').length} 待处理
                </Text>
              </Tooltip>
            ) : (
              <Text type="secondary">{rows.length}</Text>
            )}
          </span>
        </div>
        {canCreate && onCreateRequest && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onCreateRequest}
          >
            新建任务
          </Button>
        )}
      </div>
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务" />
      ) : (
        <ProTable<TaskRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          search={false}
          pagination={false}
          options={false}
          toolBarRender={false}
          cardBordered={false}
          scroll={{ x: 760 }}
          size="small"
        />
      )}
    </>
  );
}

/**
 * TasksTab 的 standalone 包装：拉任务列表 + 用户列表（assignee options），
 * 由父级（CustomerDrawer）通过 createOpen / onCreateRequest 控制 Modal 开关。
 */
interface TasksTabStandaloneProps {
  customer: CustomerDetail;
  refreshKey: number;
  createOpen: boolean;
  onCreateRequest: () => void;
  onModalOpenChange: (open: boolean) => void;
  currentUserId?: number;
}

export function TasksTabStandalone({
  customer,
  refreshKey,
  createOpen,
  onCreateRequest,
  onModalOpenChange,
  currentUserId,
}: TasksTabStandaloneProps) {
  const [assigneeOptions, setAssigneeOptions] = useState<
    Array<{ value: number; label: string }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    getUserList({ page: 1, pageSize: 100 })
      .then((res: unknown) => {
        if (cancelled) return;
        const data =
          (
            res as {
              data?: {
                items?: Array<{
                  id: number;
                  realName?: string | null;
                  username?: string | null;
                }>;
              };
            }
          )?.data?.items ?? [];
        setAssigneeOptions(
          data.map((u) => ({
            value: u.id,
            label: u.realName ? `${u.realName}` : u.username || `用户 #${u.id}`,
          })),
        );
      })
      .catch(() => {
        // 拉取失败不阻塞 Modal；assigneeOptions 保持空数组，下拉禁用
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <TasksTab
        customer={customer}
        refreshKey={refreshKey}
        onCreateRequest={onCreateRequest}
        currentUserId={currentUserId}
      />
      <TaskCreateModal
        open={createOpen}
        onOpenChange={onModalOpenChange}
        customerId={customer.id}
        assigneeOptions={assigneeOptions}
        defaultAssigneeId={currentUserId}
        onSuccess={() => {
          // Tab 自身有 refreshKey 触发 reload；这里只通知父级刷 customer 详情。
        }}
      />
    </>
  );
}
