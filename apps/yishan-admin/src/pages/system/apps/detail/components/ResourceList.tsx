import React, { useEffect, useState } from 'react';
import { Button, Spin, Empty, Tree, Dropdown, Input, message, Modal, Tooltip, TreeSelect } from 'antd';
import { PlusOutlined, FormOutlined, FileTextOutlined, LinkOutlined, BarChartOutlined, DashboardOutlined, FolderOutlined, SettingOutlined, EditOutlined, SwapOutlined, EyeInvisibleOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { getAppResourceTree, updateAppResource, deleteAppResource } from '@/services/yishan-admin/sysAppResources';
import type { DataNode } from 'antd/es/tree';
import type { TreeProps, MenuProps, TreeSelectProps } from 'antd';
import type { MenuInfo } from 'rc-menu/es/interface';
import styles from './resourceList.less';

interface ResourceListProps {
  appId: number;
  onSelect: (resource: API.sysAppResource) => void;
  selectedId?: number;
  onCreate: (type?: string, parentId?: number) => void;
  refreshTrigger?: number;
}

const NodeTitle: React.FC<{
  title: React.ReactNode;
  node: API.appResourceTreeNode;
  onCreate: (type?: string, parentId?: number) => void;
  onRename: (node: API.appResourceTreeNode) => void;
  onMove: (node: API.appResourceTreeNode) => void;
  onAccess: (node: API.appResourceTreeNode) => void;
  onHidePc: (node: API.appResourceTreeNode) => void;
  onHideMobile: (node: API.appResourceTreeNode) => void;
  onViewForm: (node: API.appResourceTreeNode) => void;
  onDelete: (node: API.appResourceTreeNode) => void;
}> = ({ title, node, onCreate, onRename, onMove, onAccess, onHidePc, onHideMobile, onViewForm, onDelete }) => {
  const stopPropagation = (event: MenuInfo) => {
    event.domEvent.stopPropagation();
  };

  const items: MenuProps['items'] = [
    ...(node.type === 'FOLDER'
      ? [
        { key: 'create', label: '新建页面', icon: <PlusOutlined />, onClick: (e: MenuInfo) => { stopPropagation(e); onCreate(undefined, node.id); } },
        { type: 'divider' as const },
      ]
      : []),
    { key: 'rename', label: '修改名称', icon: <EditOutlined />, onClick: (e: MenuInfo) => { stopPropagation(e); onRename(node); } },
    { key: 'move', label: '移动到', icon: <SwapOutlined />, onClick: (e: MenuInfo) => { stopPropagation(e); onMove(node); } },
    { key: 'access', label: '访问', icon: <LinkOutlined />, onClick: (e: MenuInfo) => { stopPropagation(e); onAccess(node); } },
    {
      type: 'group',
      key: 'visibility',
      label: '隐藏',
      children: [
        { key: 'hidePc', label: '隐藏PC端', icon: <EyeInvisibleOutlined />, onClick: (e: MenuInfo) => { stopPropagation(e); onHidePc(node); } },
        { key: 'hideMobile', label: '隐藏移动端', icon: <EyeInvisibleOutlined />, onClick: (e: MenuInfo) => { stopPropagation(e); onHideMobile(node); } },
      ],
    },
    ...(node.type === 'FORM'
      ? [{ key: 'viewForm', label: '查看原表单', icon: <FormOutlined />, onClick: (e: MenuInfo) => { stopPropagation(e); onViewForm(node); } }]
      : []),
    { type: 'divider' as const },
    { key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: (e: MenuInfo) => { stopPropagation(e); onDelete(node); } },
  ];

  return (
    <div
      className={styles.treeItemNodeTitleWrap}
    >
      <Tooltip title={node.name} placement="topLeft">
        <span className={styles.treeItemNodeTitle}>
          {title}
        </span>
      </Tooltip>
      <span className={styles.treeItemNodeTitleActions}>
        <Dropdown
          menu={{ items }}
          trigger={['hover']}
        >
          <SettingOutlined
            onClick={(e) => e.stopPropagation()}
            className={styles.treeItemNodeTitleActionIcon}
          />
        </Dropdown>
      </span>
    </div>
  );
};

const ResourceList: React.FC<ResourceListProps> = ({ appId, onSelect, selectedId, onCreate, refreshTrigger }) => {
  const [resources, setResources] = useState<API.sysAppResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [resourceTree, setResourceTree] = useState<API.appResourceTreeNode[]>([]);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [flatData, setFlatData] = useState<{ key: number; title: string; parentKey?: number }[]>([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<number | undefined>(undefined);
  const [actionNode, setActionNode] = useState<API.appResourceTreeNode | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (appId) {
      loadResources();
    }
  }, [appId, refreshTrigger]);

  const flattenTree = (list: API.appResourceTreeNode[], parentKey?: number): { key: number; title: string; parentKey?: number }[] => {
    return list.reduce((acc, item) => {
      acc.push({ key: item.id, title: item.name, parentKey });
      if (item.children) {
        acc.push(...flattenTree(item.children, item.id));
      }
      return acc;
    }, [] as { key: number; title: string; parentKey?: number }[]);
  };

  const cloneTree = (list: API.appResourceTreeNode[]): API.appResourceTreeNode[] => {
    return list.map((item) => ({
      ...item,
      children: item.children ? cloneTree(item.children) : item.children,
    }));
  };

  const findNodeById = (list: API.appResourceTreeNode[], id: number): API.appResourceTreeNode | undefined => {
    for (const item of list) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findNodeById(item.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const findParentId = (list: API.appResourceTreeNode[], id: number, parentId?: number): number | undefined => {
    for (const item of list) {
      if (item.id === id) return parentId;
      if (item.children) {
        const found = findParentId(item.children, id, item.id);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };

  const isDescendant = (node: API.appResourceTreeNode, targetId: number): boolean => {
    if (!node.children) return false;
    for (const child of node.children) {
      if (child.id === targetId) return true;
      if (isDescendant(child, targetId)) return true;
    }
    return false;
  };

  const loadResources = async () => {
    setLoading(true);
    try {
      const res = await getAppResourceTree({ appId });
      if (res.data) {
        const flatList = flattenTree(res.data);
        setFlatData(flatList);
        setResources(flatList as any);
        setResourceTree(res.data);
        setTreeData(convertToDataNode(res.data));
        setExpandedKeys(flatList.map(item => item.key)); // Default expand all
      }
    } finally {
      setLoading(false);
    }
  };

  const onExpand = (newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys);
    setAutoExpandParent(false);
  };

  const getParentKeys = (key: number, flatList: typeof flatData): number[] => {
    const parentKeys: number[] = [];
    let currentKey: number | undefined = key;
    while (currentKey) {
      const item = flatList.find(i => i.key === currentKey);
      if (item?.parentKey) {
        parentKeys.push(item.parentKey);
        currentKey = item.parentKey;
      } else {
        currentKey = undefined;
      }
    }
    return parentKeys;
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const newExpandedKeys = flatData
      .flatMap((item) => {
        if (item.title.indexOf(value) > -1) {
          return getParentKeys(item.key, flatData);
        }
        return [];
      })
      .filter((item, i, self) => self.indexOf(item) === i);

    setExpandedKeys(newExpandedKeys as React.Key[]);
    setSearchValue(value);
    setAutoExpandParent(true);
  };

  const buildFolderOptions = (nodes: API.appResourceTreeNode[], exclude?: API.appResourceTreeNode): NonNullable<TreeSelectProps['treeData']> => {
    return nodes.reduce<NonNullable<TreeSelectProps['treeData']>>((acc, item) => {
      if (exclude && (item.id === exclude.id || isDescendant(exclude, item.id))) {
        return acc;
      }
      if (item.type !== 'FOLDER') {
        if (item.children) {
          acc.push(...buildFolderOptions(item.children, exclude));
        }
        return acc;
      }
      const children = item.children ? buildFolderOptions(item.children, exclude) : undefined;
      acc.push({ title: item.name, value: item.id, key: item.id, children });
      return acc;
    }, [] as NonNullable<TreeSelectProps['treeData']>);
  };

  const openRename = (node: API.appResourceTreeNode) => {
    setActionNode(node);
    setRenameValue(node.name);
    setRenameOpen(true);
  };

  const handleRenameOk = async () => {
    if (!actionNode) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      message.warning('请输入名称');
      return;
    }
    if (nextName === actionNode.name) {
      setRenameOpen(false);
      return;
    }
    setActionLoading(true);
    try {
      await updateAppResource({ appId, id: actionNode.id }, { name: nextName });
      message.success('名称已更新');
      setRenameOpen(false);
      loadResources();
    } catch {
      message.error('修改失败');
    } finally {
      setActionLoading(false);
    }
  };

  const openMove = (node: API.appResourceTreeNode) => {
    setActionNode(node);
    setMoveTargetId(node.parentId ?? 0);
    setMoveOpen(true);
  };

  const handleMoveOk = async () => {
    if (!actionNode) return;
    if (moveTargetId === undefined) {
      message.warning('请选择目标分组');
      return;
    }
    const nextParentId = moveTargetId === 0 ? undefined : moveTargetId;
    if (nextParentId === actionNode.parentId || (nextParentId === undefined && actionNode.parentId === undefined)) {
      setMoveOpen(false);
      return;
    }
    setActionLoading(true);
    try {
      await updateAppResource({ appId, id: actionNode.id }, { parentId: nextParentId });
      message.success('已移动');
      setMoveOpen(false);
      loadResources();
    } catch {
      message.error('移动失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccess = (node: API.appResourceTreeNode) => {
    if (node.type === 'FOLDER') {
      message.info('分组不支持访问');
      return;
    }
    onSelect(node as API.sysAppResource);
  };

  const handleHidePc = () => {
    message.info('隐藏PC端功能开发中');
  };

  const handleHideMobile = () => {
    message.info('隐藏移动端功能开发中');
  };

  const handleViewForm = (node: API.appResourceTreeNode) => {
    if (node.type !== 'FORM') return;
    message.info('查看原表单功能开发中');
  };

  const handleDelete = (node: API.appResourceTreeNode) => {
    Modal.confirm({
      title: '确认删除',
      content: `确认删除「${node.name}」吗？`,
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteAppResource({ appId, id: node.id });
          message.success('已删除');
          loadResources();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const onDragEnter: TreeProps['onDragEnter'] = (info) => {
    setExpandedKeys(info.expandedKeys as React.Key[]);
  };

  const onDrop: TreeProps['onDrop'] = async (info) => {
    const dragKey = Number(info.dragNode.key);
    const dropKey = Number(info.node.key);
    if (Number.isNaN(dragKey) || Number.isNaN(dropKey)) return;
    if (!resourceTree.length) return;
    if (dragKey === dropKey) return;

    const dragNode = findNodeById(resourceTree, dragKey);
    const dropNode = findNodeById(resourceTree, dropKey);
    if (!dragNode || !dropNode) return;
    if (!info.dropToGap && dropNode.type !== 'FOLDER') {
      message.warning('只能拖拽到分组内');
      return;
    }
    if (isDescendant(dragNode, dropKey)) {
      message.warning('不能拖拽到子节点');
      return;
    }

    const data = cloneTree(resourceTree);
    let dragObj: API.appResourceTreeNode | undefined;

    const loop = (
      list: API.appResourceTreeNode[],
      key: number,
      callback: (node: API.appResourceTreeNode, index: number, arr: API.appResourceTreeNode[]) => void,
    ) => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === key) {
          return callback(list[i], i, list);
        }
        if (list[i].children) {
          loop(list[i].children as API.appResourceTreeNode[], key, callback);
        }
      }
    };

    loop(data, dragKey, (item, index, arr) => {
      arr.splice(index, 1);
      dragObj = item;
    });

    if (!dragObj) return;

    if (!info.dropToGap) {
      loop(data, dropKey, (item) => {
        item.children = item.children ? [dragObj as API.appResourceTreeNode, ...item.children] : [dragObj as API.appResourceTreeNode];
      });
    } else {
      let ar: API.appResourceTreeNode[] = [];
      let i = 0;
      loop(data, dropKey, (_item, index, arr) => {
        ar = arr;
        i = index;
      });
      const dropPos = info.node.pos.split('-');
      const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);
      if (dropPosition === -1) {
        ar.splice(i, 0, dragObj as API.appResourceTreeNode);
      } else {
        ar.splice(i + 1, 0, dragObj as API.appResourceTreeNode);
      }
    }

    setResourceTree(data);
    const flatList = flattenTree(data);
    setFlatData(flatList);
    setResources(flatList as any);
    setTreeData(convertToDataNode(data));

    const newParentId = info.dropToGap ? findParentId(data, dropKey) : dropKey;
    const normalizedParentId = newParentId ?? 0;
    const siblings = normalizedParentId === 0 ? data : (findNodeById(data, normalizedParentId)?.children || []);

    try {
      await Promise.all(
        siblings.map((item, index) =>
          updateAppResource(
            { appId, id: item.id },
            {
              parentId: normalizedParentId === 0 ? undefined : normalizedParentId,
              sort_order: index + 1,
            },
          ),
        ),
      );
      message.success('排序已更新');
    } catch {
      message.error('排序更新失败');
      loadResources();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'FORM': return <FormOutlined />;
      case 'REPORT': return <BarChartOutlined />;
      case 'DASHBOARD': return <DashboardOutlined />;
      case 'EXTERNAL_LINK': return <LinkOutlined />;
      case 'FOLDER': return <FolderOutlined />;
      default: return <FileTextOutlined />;
    }
  };

  const convertToDataNode = (nodes: API.appResourceTreeNode[]): DataNode[] => {
    return nodes.map(node => {
      const index = node.name.indexOf(searchValue);
      const beforeStr = node.name.substring(0, index);
      const afterStr = node.name.slice(index + searchValue.length);
      const title =
        index > -1 ? (
          <span key={`title-highlight-${node.id}`}>
            {beforeStr}
            <span style={{ color: '#f50' }}>{searchValue}</span>
            {afterStr}
          </span>
        ) : (
          <span key={`title-${node.id}`}>{node.name}</span>
        );

      return {
        key: node.id,
        title: (
          <NodeTitle
            title={title}
            node={node}
            onCreate={onCreate}
            onRename={openRename}
            onMove={openMove}
            onAccess={handleAccess}
            onHidePc={handleHidePc}
            onHideMobile={handleHideMobile}
            onViewForm={handleViewForm}
            onDelete={handleDelete}
          />
        ),
        icon: getIcon(node.type),
        isLeaf: node.type !== 'FOLDER' && (!node.children || node.children.length === 0),
        children: node.children && node.children.length > 0 ? convertToDataNode(node.children) : undefined,
        data: node
      };
    });
  };

  return (
    <div style={{ width: 256, borderRight: '1px solid #f0f0f0', height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <div style={{ padding: '16px 16px 8px', display: 'flex', gap: 8, alignItems: 'center', height: 56 }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#ccc' }} />}
          placeholder="搜索页面"
          allowClear
          value={searchValue}
          onChange={onChange}
          style={{ flex: 1 }}
        />
        <Dropdown
          menu={{
            items: [
              { key: 'page', label: '新建页面', icon: <PlusOutlined />, onClick: () => onCreate() },
              { key: 'folder', label: '新建分组', icon: <FolderOutlined />, onClick: () => onCreate('FOLDER') },
            ]
          }}
          trigger={['hover']}
        >
          <Button icon={<PlusOutlined />} />
        </Dropdown>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '0 0 8px' }}>
        <Spin spinning={loading}>
          {resources.length === 0 && !loading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无页面" />
          ) : (
            <Tree
              blockNode
              draggable
              showIcon
              onExpand={onExpand}
              onDragEnter={onDragEnter}
              onDrop={onDrop}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              treeData={treeData}
              selectedKeys={selectedId ? [selectedId.toString()] : []}
              onSelect={(keys, info) => {
                if (keys.length > 0) {
                  // @ts-expect-error
                  const resource = info.node.data as API.sysAppResource;
                  if (resource.type !== 'FOLDER') {
                    onSelect(resource);
                  }
                }
              }}
              classNames={{
                 item: styles.treeItem,
                itemTitle: styles.treeItemTitle
              }}
            />
          )}
        </Spin>
      </div>
      <Modal
        title="修改名称"
        open={renameOpen}
        onOk={handleRenameOk}
        onCancel={() => setRenameOpen(false)}
        confirmLoading={actionLoading}
        okText="保存"
        cancelText="取消"
      >
        <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="请输入名称" />
      </Modal>
      <Modal
        title="移动到"
        open={moveOpen}
        onOk={handleMoveOk}
        onCancel={() => setMoveOpen(false)}
        confirmLoading={actionLoading}
        okText="移动"
        cancelText="取消"
      >
        <TreeSelect
          value={moveTargetId}
          onChange={(value) => setMoveTargetId(value as number)}
          treeData={[
            { title: '根目录', value: 0, key: 0, children: buildFolderOptions(resourceTree, actionNode ?? undefined) },
          ]}
          treeDefaultExpandAll
          placeholder="请选择目标分组"
          allowClear
          style={{ width: '100%' }}
        />
      </Modal>
    </div>
  );
};

export default ResourceList;
