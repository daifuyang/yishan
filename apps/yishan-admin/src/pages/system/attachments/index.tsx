import {
  CustomerServiceOutlined,
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  PlusOutlined,
  UploadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Upload, Button, Card, Popconfirm, App, Image, Tag, Tooltip, Tree, Input, List, Tabs, Modal, Checkbox, Space } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { UploadProps } from 'antd';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  batchDeleteAttachments,
  deleteAttachment,
  deleteAttachmentFolder,
  getAttachmentFolderTree,
  getAttachmentList,
  uploadAttachments,
} from '@/services/yishan-admin/attachments';
import AttachmentFolderForm from './components/AttachmentFolderForm';
import AttachmentForm from './components/AttachmentForm';

const attachmentKindMeta: Record<API.sysAttachment['kind'], { color: string; text: string }> = {
  image: { color: 'blue', text: '图片' },
  audio: { color: 'purple', text: '音频' },
  video: { color: 'cyan', text: '视频' },
  other: { color: 'default', text: '其他' },
};

const formatBytes = (value?: number) => {
  if (!value || value <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const fixed = idx === 0 ? 0 : 2;
  return `${size.toFixed(fixed)} ${units[idx]}`;
};

const findFolderById = (nodes: API.sysAttachmentFolder[] = [], id: number): API.sysAttachmentFolder | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (Array.isArray(n.children) && n.children.length > 0) {
      const found = findFolderById(n.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

type FolderItem = {
  id: number;
  name: string;
  displayName: string;
  kind: API.sysAttachmentFolder['kind'];
  level: number;
  parentIds: number[];
};

const flattenFolders = (
  nodes: API.sysAttachmentFolder[] = [],
  prefix: string[] = [],
  level = 1,
  parentIds: number[] = []
): FolderItem[] => {
  const list: FolderItem[] = [];
  for (const n of nodes) {
    const path = [...prefix, n.name];
    list.push({
      id: n.id,
      name: n.name,
      displayName: path.join(' / '),
      kind: n.kind || 'all',
      level,
      parentIds,
    });
    if (Array.isArray(n.children) && n.children.length > 0) {
      list.push(...flattenFolders(n.children, path, level + 1, [...parentIds, n.id]));
    }
  }
  return list;
};

const highlightText = (text: string, keyword: string) => {
  if (!keyword) return text;
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase();
  const idx = lower.indexOf(k);
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const hit = text.slice(idx, idx + keyword.length);
  const after = text.slice(idx + keyword.length);
  return (
    <>
      {before}
      <span style={{ color: '#1677ff' }}>{hit}</span>
      {after}
    </>
  );
};

const getKindFromFile = (file: File): API.sysAttachment['kind'] => {
  const mime = file.type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
};

const AttachmentsPage: React.FC = () => {
  const { message } = App.useApp();

  const [folderTree, setFolderTree] = useState<API.sysAttachmentFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number>(0);
  const [hoveredFolderId, setHoveredFolderId] = useState<number | null>(null);
  const [folderSearchValue, setFolderSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  const [attachments, setAttachments] = useState<API.sysAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsPage, setAttachmentsPage] = useState(1);
  const [attachmentsPageSize, setAttachmentsPageSize] = useState(24);
  const [attachmentsTotal, setAttachmentsTotal] = useState(0);
  const [kindTab, setKindTab] = useState<API.sysAttachment['kind'] | 'all'>('all');
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<number[]>([]);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);
  const [mediaPreviewKind, setMediaPreviewKind] = useState<'audio' | 'video' | null>(null);
  const [mediaPreviewSrc, setMediaPreviewSrc] = useState('');
  const [mediaPreviewTitle, setMediaPreviewTitle] = useState('');

  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [gridContainerWidth, setGridContainerWidth] = useState(0);

  const selectedFolder = useMemo(() => {
    if (!selectedFolderId) return undefined;
    return findFolderById(folderTree, selectedFolderId);
  }, [folderTree, selectedFolderId]);

  const folderItems: FolderItem[] = useMemo(() => {
    return [{ id: 0, name: '全部素材', displayName: '全部素材', kind: 'all', level: 0, parentIds: [] }, ...flattenFolders(folderTree)];
  }, [folderTree]);

  const refreshFolders = async () => {
    try {
      setLoadingFolders(true);
      const res = await getAttachmentFolderTree();
      setFolderTree(res.data || []);
    } finally {
      setLoadingFolders(false);
    }
  };

  useEffect(() => {
    refreshFolders();
  }, []);

  const uploadProps: UploadProps = useMemo(
    () => ({
      multiple: true,
      showUploadList: false,
      customRequest: async (options: any) => {
        const { file, onSuccess, onError } = options;
        try {
          const f: File = file as File;
          const formData = new FormData();
          formData.append('file', f);

          const params: API.uploadAttachmentsParams = {
            folderId: selectedFolderId > 0 ? selectedFolderId : undefined,
            kind: getKindFromFile(f),
          };
          const res = await uploadAttachments(params, { data: formData });
          if (res.success) {
            message.success(res.message || '上传成功');
            setAttachmentsPage(1);
            fetchAttachments(1, attachmentsPageSize, kindTab);
            onSuccess?.(res, file as any);
            return;
          }
          onError?.(new Error(res.message || '上传失败'));
        } catch (e: any) {
          onError?.(e);
        }
      },
    }),
    [attachmentsPageSize, kindTab, message, selectedFolderId]
  );

  const handleFolderActionSuccess = async () => {
    await refreshFolders();
    setAttachmentsPage(1);
  };

  const handleDeleteAttachment = async (id: number) => {
    const res = await deleteAttachment({ id });
    if (res.success) message.success(res.message);
    setSelectedAttachmentIds((prev) => prev.filter((x) => x !== id));
    setAttachmentsPage(1);
    fetchAttachments(1, attachmentsPageSize, kindTab);
  };

  const handleBatchDeleteAttachment = async () => {
    if (selectedAttachmentIds.length === 0) return;
    try {
      setBatchDeleteLoading(true);
      const res = await batchDeleteAttachments({ ids: selectedAttachmentIds });
      if (res.success) message.success(res.message);
      setSelectedAttachmentIds([]);
      setAttachmentsPage(1);
      fetchAttachments(1, attachmentsPageSize, kindTab);
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  useEffect(() => {
    setSelectedAttachmentIds([]);
  }, [selectedFolderId, kindTab]);

  useEffect(() => {
    if (!folderItems.length) return;
    if (folderSearchValue) return;
    setExpandedKeys(folderItems.map((f) => f.id));
    setAutoExpandParent(true);
  }, [folderItems, folderSearchValue]);

  useEffect(() => {
    const keyword = folderSearchValue.trim();
    if (!keyword) return;
    const keys = new Set<React.Key>();
    for (const item of folderItems) {
      if (item.id === 0) continue;
      if (item.name.toLowerCase().includes(keyword.toLowerCase())) {
        for (const id of item.parentIds) {
          keys.add(id);
        }
      }
    }
    setExpandedKeys(Array.from(keys));
    setAutoExpandParent(true);
  }, [folderItems, folderSearchValue]);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;

    const update = () => {
      const width = el.clientWidth || el.getBoundingClientRect().width || 0;
      setGridContainerWidth(width);
    };

    update();

    const RO = (window as any).ResizeObserver as typeof ResizeObserver | undefined;
    if (RO) {
      const ro = new RO(() => update());
      ro.observe(el);
      return () => ro.disconnect();
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const gridColumns = useMemo(() => {
    const w = gridContainerWidth || 0;
    if (w < 576) return 2;
    if (w < 768) return 3;
    if (w < 992) return 4;
    if (w < 1200) return 5;
    if (w < 1600) return 6;
    return 7;
  }, [gridContainerWidth]);

  const stopTreeActionEvent = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const treeData: DataNode[] = useMemo(() => {
    const build = (nodes: API.sysAttachmentFolder[] = [], level = 1): DataNode[] => {
      return nodes.map((n) => {
        const canCreateChild = level < 3;
        const showActions = hoveredFolderId === n.id;
        const title = (
          <div
            key={n.id}
            onMouseEnter={() => setHoveredFolderId(n.id)}
            onMouseLeave={() => setHoveredFolderId((prev) => (prev === n.id ? null : prev))}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {highlightText(n.name, folderSearchValue)}
            </span>
            <span
              data-tree-action="1"
              onMouseDownCapture={stopTreeActionEvent}
              onClickCapture={stopTreeActionEvent}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, opacity: showActions ? 1 : 0 }}
            >
              <AttachmentFolderForm
                title="新建子分组"
                trigger={
                  <Button type="text" size="small" icon={<PlusOutlined />} disabled={!canCreateChild} />
                }
                initialValues={{ parentId: n.id, kind: (n.kind as any) || 'all', status: '1', sort_order: 0 }}
                onFinish={handleFolderActionSuccess}
              />
              <AttachmentFolderForm
                title="编辑分组"
                trigger={
                  <Button type="text" size="small" icon={<EditOutlined />} />
                }
                initialValues={{ ...n, parentId: (n.parentId as any) ?? 0 }}
                onFinish={handleFolderActionSuccess}
              />
              <Popconfirm
                title="确定要删除该分组吗？"
                onConfirm={async () => {
                  if (!n.id) return;
                  const res = await deleteAttachmentFolder({ id: n.id });
                  if (res.success) message.success(res.message);
                  if (selectedFolderId === n.id) setSelectedFolderId(0);
                  await refreshFolders();
                }}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </span>
          </div>
        );

        return {
          key: n.id,
          title,
          children: n.children ? build(n.children, level + 1) : undefined,
        };
      });
    };

    const rootShowActions = hoveredFolderId === 0;
    return [
      {
        key: 0,
        title: (
          <div
            key={0}
            onMouseEnter={() => setHoveredFolderId(0)}
            onMouseLeave={() => setHoveredFolderId((prev) => (prev === 0 ? null : prev))}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {highlightText('全部素材', folderSearchValue)}
            </span>
            <span
              data-tree-action="1"
              onMouseDownCapture={stopTreeActionEvent}
              onClickCapture={stopTreeActionEvent}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, opacity: rootShowActions ? 1 : 0 }}
            >
              <AttachmentFolderForm
                title="新建分组"
                trigger={
                  <Button type="text" size="small" icon={<PlusOutlined />} />
                }
                initialValues={{ parentId: 0, kind: 'all', status: '1', sort_order: 0 }}
                onFinish={handleFolderActionSuccess}
              />
            </span>
          </div>
        ),
        children: build(folderTree),
      },
    ];
  }, [
    folderSearchValue,
    folderTree,
    handleFolderActionSuccess,
    hoveredFolderId,
    message,
    refreshFolders,
    selectedFolderId,
    stopTreeActionEvent,
  ]);

  const fetchAttachments = async (page: number, pageSize: number, kind: API.sysAttachment['kind'] | 'all') => {
    setAttachmentsLoading(true);
    try {
      const result = await getAttachmentList({
        page,
        pageSize,
        folderId: selectedFolderId > 0 ? selectedFolderId : undefined,
        kind: kind === 'all' ? undefined : kind,
      });
      setAttachments(result.data || []);
      setAttachmentsTotal(result.pagination.total);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments(attachmentsPage, attachmentsPageSize, kindTab);
  }, [attachmentsPage, attachmentsPageSize, kindTab, selectedFolderId]);

  const openMediaPreview = (record: API.sysAttachment) => {
    if (record.kind !== 'audio' && record.kind !== 'video') return;
    const src = record.url || record.path;
    if (!src) {
      message.warning('暂无可预览地址');
      return;
    }
    setMediaPreviewKind(record.kind);
    setMediaPreviewSrc(src);
    setMediaPreviewTitle(record.name || (record.kind === 'audio' ? '音频预览' : '视频预览'));
    setMediaPreviewOpen(true);
  };

  const getAttachmentCover = (record: API.sysAttachment) => {
    const src = record.url || record.path;
    if (record.kind === 'image' && src) {
      return (
        <Image
          src={src}
          preview={{ src }}
          style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
        />
      );
    }
    const icon =
      record.kind === 'audio'
        ? <CustomerServiceOutlined />
        : record.kind === 'video'
          ? <VideoCameraOutlined />
          : <FileOutlined />;
    const canPreview = (record.kind === 'audio' || record.kind === 'video') && !!src;
    return (
      <div
        onClick={canPreview ? () => openMediaPreview(record) : undefined}
        style={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.02)',
          fontSize: 44,
          color: 'rgba(0,0,0,0.45)',
          cursor: canPreview ? 'pointer' : 'default',
        }}
      >
        {canPreview ? <Tooltip title="预览">{icon}</Tooltip> : icon}
      </div>
    );
  };
  
  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: 12 }}>
        <Card title="分组" style={{ width: 280, flex: '0 0 280px' }} loading={loadingFolders}>
          <Input.Search
            placeholder="搜索分组"
            allowClear
            value={folderSearchValue}
            onChange={(e) => setFolderSearchValue(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Tree
            selectedKeys={[selectedFolderId]}
            treeData={treeData}
            expandedKeys={expandedKeys}
            autoExpandParent={autoExpandParent}
            onExpand={(keys) => {
              setExpandedKeys(keys);
              setAutoExpandParent(false);
            }}
            onSelect={(keys, info: any) => {
              const target = info?.nativeEvent?.target as HTMLElement | null;
              if (target?.closest?.('[data-tree-action="1"]')) return;
              const key = Number(keys[0] ?? 0);
              setSelectedFolderId(key);
              setAttachmentsPage(1);
            }}
            defaultExpandAll
            blockNode
            showIcon={false}
          />
        </Card>

        <Card style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontWeight: 500 }}>
              {selectedFolderId > 0 ? `素材（${selectedFolder?.name || '分组'}）` : '素材'}
            </div>
            <Space>
              <Popconfirm
                title={`确定要删除选中的 ${selectedAttachmentIds.length} 个素材吗？`}
                onConfirm={handleBatchDeleteAttachment}
                disabled={selectedAttachmentIds.length === 0 || batchDeleteLoading}
              >
                <Button
                  danger
                  disabled={selectedAttachmentIds.length === 0 || batchDeleteLoading}
                  loading={batchDeleteLoading}
                >
                  <DeleteOutlined /> 批量删除{selectedAttachmentIds.length ? `（${selectedAttachmentIds.length}）` : ''}
                </Button>
              </Popconfirm>
              <Button
                type="link"
                className="p-0"
                disabled={selectedAttachmentIds.length === 0 || batchDeleteLoading}
                onClick={() => setSelectedAttachmentIds([])}
              >
                清空选择
              </Button>
              <Upload {...uploadProps}>
                <Button type="primary">
                  <UploadOutlined /> 上传
                </Button>
              </Upload>
            </Space>
          </div>

          <div style={{ marginTop: 12 }}>
            <Tabs
              activeKey={kindTab}
              onChange={(k) => {
                setKindTab(k as API.sysAttachment['kind'] | 'all');
                setAttachmentsPage(1);
              }}
              items={[
                { key: 'all', label: '全部' },
                { key: 'image', label: '图片' },
                { key: 'audio', label: '音频' },
                { key: 'video', label: '视频' },
                { key: 'other', label: '其他' },
              ]}
            />

            <div ref={gridContainerRef}>
              <List
                loading={attachmentsLoading}
                grid={{ gutter: 12, column: gridColumns }}
                dataSource={attachments}
                pagination={{
                  current: attachmentsPage,
                  pageSize: attachmentsPageSize,
                  total: attachmentsTotal,
                  showSizeChanger: true,
                  onChange: (page, pageSize) => {
                    setAttachmentsPage(page);
                    setAttachmentsPageSize(pageSize);
                  },
                }}
                renderItem={(item) => {
                  const kind = attachmentKindMeta[item.kind] || attachmentKindMeta.other;
                  const checked = selectedAttachmentIds.includes(item.id);
                  return (
                    <List.Item>
                      <div style={{ position: 'relative', width: '100%' }}>
                        <Checkbox
                          checked={checked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setSelectedAttachmentIds((prev) => {
                              if (next) return prev.includes(item.id) ? prev : [...prev, item.id];
                              return prev.filter((x) => x !== item.id);
                            });
                          }}
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            zIndex: 2,
                            background: 'rgba(255,255,255,0.9)',
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        />
                        <Card
                          size="small"
                          style={{ height: '100%' }}
                          cover={getAttachmentCover(item)}
                          actions={[
                            <AttachmentForm
                              key="edit"
                              title="编辑素材"
                              trigger={<Button type="text" icon={<EditOutlined />} />}
                              initialValues={item}
                              onFinish={async () => {
                                fetchAttachments(attachmentsPage, attachmentsPageSize, kindTab);
                              }}
                            />,
                            <Popconfirm key="delete" title="确定要删除该素材吗？" onConfirm={() => handleDeleteAttachment(item.id)}>
                              <Button type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>,
                          ]}
                        >
                          <Tooltip title={item.filename || '-'}>
                            <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name || item.originalName || item.filename || '-'}
                            </div>
                          </Tooltip>
                          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <Tag color={kind.color}>{kind.text}</Tag>
                            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>{formatBytes(item.size)}</span>
                          </div>
                        </Card>
                      </div>
                    </List.Item>
                  );
                }}
              />
            </div>
          </div>
        </Card>
      </div>
      <Modal
        open={mediaPreviewOpen}
        title={mediaPreviewTitle}
        footer={null}
        destroyOnClose
        onCancel={() => {
          setMediaPreviewOpen(false);
          setMediaPreviewKind(null);
          setMediaPreviewSrc('');
          setMediaPreviewTitle('');
        }}
      >
        {mediaPreviewKind === 'audio' ? (
          <audio style={{ width: '100%' }} controls autoPlay src={mediaPreviewSrc}>
            <track kind="captions" src="data:text/vtt,WEBVTT%0A%0A" srcLang="zh" label="captions" default />
          </audio>
        ) : mediaPreviewKind === 'video' ? (
          <video style={{ width: '100%' }} controls autoPlay src={mediaPreviewSrc}>
            <track kind="captions" src="data:text/vtt,WEBVTT%0A%0A" srcLang="zh" label="captions" default />
          </video>
        ) : null}
      </Modal>
    </PageContainer>
  );
};

export default AttachmentsPage;

