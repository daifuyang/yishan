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
import { useModel } from '@umijs/max';
import type { UploadProps } from 'antd';
import {
  App,
  Button,
  Card,
  Checkbox,
  Empty,
  Image,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Tree,
  Upload,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import React, { useCallback, useMemo, useRef } from 'react';
import { AttachmentEditForm } from '@/components/AttachmentEditForm';
import { deleteAttachmentFolder, uploadAttachments } from '@/services/generated/attachments';
import { resolveAttachmentPublicUrl } from '@/utils/attachmentUpload';
import { attachmentKindMeta } from './constants';
import { getKindFromFile, highlightText, flattenFolders as _ff } from './utils';
import { useAttachmentFolders } from './hooks/useAttachmentFolders';
import { useAttachmentGridColumns } from './hooks/useAttachmentGridColumns';
import AttachmentFolderForm from './components/AttachmentFolderForm';
import styles from './index.module.less';

const AttachmentsPage: React.FC = () => {
  const { message } = App.useApp();
  const { initialState } = useModel('@@initialState');
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const folder = useAttachmentFolders(message);
  const { gridColumns } = useAttachmentGridColumns(gridContainerRef, true);

  const uploadProps: UploadProps = useMemo(
    () => ({
      multiple: true,
      showUploadList: false,
      customRequest: async (options: any) => {
        const { file, onSuccess, onError } = options;
        try {
          const f: File = file as File;
          const upload = initialState?.uploadAttachmentFile;
          if (!upload) {
            onError?.(new Error('上传能力未初始化'));
            return;
          }
          const res = await upload(f, {
            folderId: folder.selectedFolderId > 0 ? folder.selectedFolderId : undefined,
            kind: getKindFromFile(f),
            dir: 'attachments',
          });
          if (res.success) {
            message.success(res.message || '上传成功');
            folder.setAttachmentsPage(1);
            onSuccess?.(res, file as any);
            return;
          }
          onError?.(new Error(res.message || '上传失败'));
        } catch (e: any) {
          if (e instanceof Error) message.error(e.message);
          onError?.(e);
        }
      },
    }),
    [initialState?.uploadAttachmentFile, folder.selectedFolderId, message],
  );

  const stopTreeActionEvent = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const treeData: DataNode[] = useMemo(() => {
    const build = (nodes: API.sysAttachmentFolder[] = [], level = 1): DataNode[] =>
      nodes.map((n) => ({
        key: n.id,
        title: (
          <div key={n.id} className={styles.folderItem}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {highlightText(n.name, folder.folderSearchValue)}
            </span>
            <span data-tree-action="1" className={styles.folderActions} onClick={stopTreeActionEvent}>
              <AttachmentFolderForm
                title="新建子分组"
                trigger={<Button type="text" size="small" icon={<PlusOutlined />} disabled={level >= 3} />}
                initialValues={{ parentId: n.id, kind: n.kind || 'all', status: '1', sort_order: 0 }}
                onFinish={folder.handleFolderActionSuccess}
              />
              <AttachmentFolderForm
                title="编辑分组"
                trigger={<Button type="text" size="small" icon={<EditOutlined />} />}
                initialValues={{ ...n, parentId: n.parentId ?? 0 }}
                onFinish={folder.handleFolderActionSuccess}
              />
              <Popconfirm title="确定要删除该分组吗？" onConfirm={async () => {
                if (!n.id) return;
                const res = await deleteAttachmentFolder({ id: n.id });
                if (res.success) message.success(res.message);
                if (folder.selectedFolderId === n.id) folder.setSelectedFolderId(0);
                await folder.refreshFolders();
              }}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </span>
          </div>
        ),
        children: n.children ? build(n.children, level + 1) : undefined,
      }));

    return [{
      key: 0,
      title: (
        <div key={0} className={styles.folderItem}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {highlightText('全部素材', folder.folderSearchValue)}
          </span>
          <span data-tree-action="1" className={styles.folderActions} onClick={stopTreeActionEvent}>
            <AttachmentFolderForm
              title="新建分组"
              trigger={<Button type="text" size="small" icon={<PlusOutlined />} />}
              initialValues={{ parentId: 0, kind: 'all', status: '1', sort_order: 0 }}
              onFinish={folder.handleFolderActionSuccess}
            />
          </span>
        </div>
      ),
      children: build(folder.folderTree),
    }];
  }, [folder.folderSearchValue, folder.folderTree, folder.handleFolderActionSuccess,
      folder.selectedFolderId, folder.refreshFolders, message, stopTreeActionEvent]);

  const folderName = folder.selectedFolder
    ? folder.selectedFolder.name
    : folder.folderSearchValue.trim()
      ? `搜索: ${folder.folderSearchValue}`
      : '全部素材';

  return (
    <PageContainer
      header={{
        title: '素材管理',
        breadcrumb: {},
      }}
    >
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 200px)' }}>
        {/* Left sidebar - folder tree */}
        <Card style={{ width: 260, flexShrink: 0 }} bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
            <Input.Search
              placeholder="搜索分组"
              value={folder.folderSearchValue}
              onChange={(e) => folder.setFolderSearchValue(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            <Spin spinning={folder.loadingFolders}>
              <Tree
                blockNode
                showIcon={false}
                selectedKeys={[folder.selectedFolderId]}
                expandedKeys={folder.expandedKeys}
                autoExpandParent={folder.autoExpandParent}
                treeData={treeData}
                onExpand={(keys) => {
                  folder.setExpandedKeys(keys);
                  folder.setAutoExpandParent(false);
                }}
                onSelect={(keys) => {
                  const id = Number(keys?.[0] || 0);
                  folder.setSelectedFolderId(Number.isFinite(id) ? id : 0);
                  folder.setAttachmentsPage(1);
                }}
                style={{ background: 'transparent' }}
              />
            </Spin>
          </div>
        </Card>

        {/* Right content */}
        <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}
          bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Toolbar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 500, fontSize: 15 }}>{folderName}</span>
              {folder.selectedAttachmentIds.length > 0 && (
                <>
                  <span style={{ color: 'rgba(0,0,0,0.45)' }}>已选 {folder.selectedAttachmentIds.length} 项</span>
                  <Button size="small" onClick={() => folder.setSelectedAttachmentIds([])}>取消选择</Button>
                  <Popconfirm title={`确定要删除选中的 ${folder.selectedAttachmentIds.length} 个素材吗？`}
                    onConfirm={folder.handleBatchDeleteAttachment}>
                    <Button size="small" danger loading={folder.batchDeleteLoading}
                      icon={<DeleteOutlined />}>批量删除</Button>
                  </Popconfirm>
                </>
              )}
            </div>
            <Space>
              <Upload {...uploadProps}>
                <Button type="primary" icon={<UploadOutlined />}>上传</Button>
              </Upload>
            </Space>
          </div>

          {/* Tabs */}
          <div style={{ padding: '0 16px', borderBottom: '1px solid #f0f0f0' }}>
            <Tabs
              activeKey={folder.kindTab}
              onChange={(k) => { folder.setKindTab(k as any); folder.setAttachmentsPage(1); }}
              items={[
                { key: 'all', label: '全部' },
                { key: 'image', label: '图片' },
                { key: 'audio', label: '音频' },
                { key: 'video', label: '视频' },
                { key: 'other', label: '其他' },
              ]}
            />
          </div>

          {/* Grid */}
          <div ref={gridContainerRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {folder.attachmentsLoading ? (
              <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
            ) : folder.attachments.length === 0 ? (
              <Empty description="暂无素材" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridColumns}, 1fr)`, gap: 12 }}>
                {folder.attachments.map((item) => {
                  const checked = folder.selectedAttachmentIds.includes(item.id);
                  const publicUrl = resolveAttachmentPublicUrl(item, initialState?.cloudStorageConfig);
                  return (
                    <Card
                      key={item.id}
                      size="small"
                      hoverable
                      style={{ borderColor: checked ? '#1677ff' : undefined }}
                      bodyStyle={{ padding: 0 }}
                      onClick={() => {
                        folder.setSelectedAttachmentIds((prev) =>
                          prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id]
                        );
                      }}
                    >
                      <div style={{ position: 'relative', aspectRatio: '1', background: '#fafafa' }}>
                        {item.kind === 'image' && publicUrl ? (
                          <Image src={publicUrl} preview={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 36, color: 'rgba(0,0,0,0.25)' }}>
                            {item.kind === 'audio' ? <CustomerServiceOutlined /> : item.kind === 'video' ? <VideoCameraOutlined /> : <FileOutlined />}
                          </div>
                        )}
                        {checked && (
                          <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}>
                            <Checkbox checked />
                          </div>
                        )}
                        {publicUrl && (item.kind === 'audio' || item.kind === 'video') && (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => { e.stopPropagation();
                              folder.setMediaPreviewKind(item.kind as any);
                              folder.setMediaPreviewSrc(publicUrl);
                              folder.setMediaPreviewTitle(item.name || item.originalName || '');
                              folder.setMediaPreviewOpen(true);
                            }}>
                            <Button type="primary" shape="circle" icon={item.kind === 'audio' ? <CustomerServiceOutlined /> : <VideoCameraOutlined />} />
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '6px 8px', fontSize: 12 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.name || item.originalName}>
                          {item.name || item.originalName}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <Tag color={attachmentKindMeta[item.kind]?.color} style={{ margin: 0, fontSize: 11 }}>
                            {attachmentKindMeta[item.kind]?.text || item.kind}
                          </Tag>
                          <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 11 }}>{(item.size ? `${(item.size / 1024).toFixed(1)} KB` : '-')}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              size="small"
              current={folder.attachmentsPage}
              pageSize={folder.attachmentsPageSize}
              total={folder.attachmentsTotal}
              onChange={(p, ps) => { folder.setAttachmentsPage(p); folder.setAttachmentsPageSize(ps); }}
              showTotal={(t) => `共 ${t} 项`}
            />
          </div>
        </Card>
      </div>

      {/* Media preview modal */}
      <Modal
        title={folder.mediaPreviewTitle}
        open={folder.mediaPreviewOpen}
        footer={null}
        destroyOnHidden
        onCancel={() => folder.setMediaPreviewOpen(false)}
        width={640}
      >
        {folder.mediaPreviewKind === 'audio' ? (
          <audio src={folder.mediaPreviewSrc} controls autoPlay style={{ width: '100%' }} />
        ) : folder.mediaPreviewKind === 'video' ? (
          <video src={folder.mediaPreviewSrc} controls autoPlay style={{ width: '100%', maxHeight: '60vh' }} />
        ) : null}
      </Modal>

      {/* Attachment edit form */}
      <AttachmentEditForm
        open={Boolean(folder.editingAttachment)}
        initialValues={folder.editingAttachment}
        onOpenChange={(next) => { if (!next) folder.setEditingAttachment(undefined); }}
        onFinish={async () => {
          folder.setAttachmentsPage(1);
        }}
      />
    </PageContainer>
  );
};

export default AttachmentsPage;
