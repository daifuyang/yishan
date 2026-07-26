import { useEffect, useMemo, useState } from 'react';
import {
  getAttachmentFolderTree,
  getAttachmentList,
  deleteAttachment,
  batchDeleteAttachments,
} from '@/services/generated/attachments';
import { findFolderById, flattenFolders } from '../utils';
import type { FolderItem } from '../types';

export function useAttachmentFolders(message: any) {
  const [folderTree, setFolderTree] = useState<API.sysAttachmentFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<number>(0);
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
  const [editingAttachment, setEditingAttachment] = useState<API.sysAttachment>();

  const [mediaPreviewOpen, setMediaPreviewOpen] = useState(false);
  const [mediaPreviewKind, setMediaPreviewKind] = useState<'audio' | 'video' | null>(null);
  const [mediaPreviewSrc, setMediaPreviewSrc] = useState('');
  const [mediaPreviewTitle, setMediaPreviewTitle] = useState('');

  const selectedFolder = useMemo(() => {
    if (!selectedFolderId) return undefined;
    return findFolderById(folderTree, selectedFolderId);
  }, [folderTree, selectedFolderId]);

  const folderItems: FolderItem[] = useMemo(() => {
    return [
      { id: 0, name: '全部素材', displayName: '全部素材', kind: 'all', level: 0, parentIds: [] },
      ...flattenFolders(folderTree),
    ];
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

  const fetchAttachments = async (page: number, pageSize: number, kind: string) => {
    try {
      setAttachmentsLoading(true);
      const res = await getAttachmentList({
        page,
        pageSize,
        folderId: selectedFolderId > 0 ? selectedFolderId : undefined,
        kind: kind === 'all' ? undefined : (kind as API.sysAttachment['kind']),
        status: '1',
      });
      setAttachments(res.data || []);
      setAttachmentsTotal(res.pagination?.total || 0);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  useEffect(() => {
    refreshFolders();
  }, []);

  useEffect(() => {
    setSelectedAttachmentIds([]);
  }, [selectedFolderId, kindTab]);

  useEffect(() => {
    if (!folderItems.length || folderSearchValue) return;
    setExpandedKeys(folderItems.map((f) => f.id));
    setAutoExpandParent(true);
  }, [folderItems, folderSearchValue]);

  useEffect(() => {
    const kw = folderSearchValue.trim();
    if (!kw) return;
    const keys = new Set<React.Key>();
    for (const item of folderItems) {
      if (item.id === 0) continue;
      if (item.name.toLowerCase().includes(kw.toLowerCase())) {
        for (const id of item.parentIds) keys.add(id);
      }
    }
    setExpandedKeys(Array.from(keys));
    setAutoExpandParent(true);
  }, [folderItems, folderSearchValue]);

  useEffect(() => {
    fetchAttachments(attachmentsPage, attachmentsPageSize, kindTab);
  }, [attachmentsPage, attachmentsPageSize, selectedFolderId, kindTab]);

  const handleDeleteAttachment = async (id: number) => {
    const res = await deleteAttachment({ id });
    if (res.success) message.success(res.message);
    setSelectedAttachmentIds((prev) => prev.filter((x) => x !== id));
    setAttachmentsPage(1);
  };

  const handleBatchDeleteAttachment = async () => {
    if (!selectedAttachmentIds.length) return;
    try {
      setBatchDeleteLoading(true);
      const res = await batchDeleteAttachments({ ids: selectedAttachmentIds });
      if (res.success) message.success(res.message);
      setSelectedAttachmentIds([]);
      setAttachmentsPage(1);
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  const handleFolderActionSuccess = async () => {
    await refreshFolders();
    setAttachmentsPage(1);
  };

  return {
    folderTree, selectedFolderId, setSelectedFolderId,
    folderSearchValue, setFolderSearchValue,
    expandedKeys, setExpandedKeys, autoExpandParent, setAutoExpandParent,
    loadingFolders, selectedFolder, folderItems,
    attachments, attachmentsLoading,
    attachmentsPage, setAttachmentsPage, attachmentsPageSize, setAttachmentsPageSize,
    attachmentsTotal, kindTab, setKindTab,
    selectedAttachmentIds, setSelectedAttachmentIds,
    batchDeleteLoading, editingAttachment, setEditingAttachment,
    mediaPreviewOpen, setMediaPreviewOpen,
    mediaPreviewKind, setMediaPreviewKind,
    mediaPreviewSrc, setMediaPreviewSrc,
    mediaPreviewTitle, setMediaPreviewTitle,
    refreshFolders,
    fetchAttachments,
    handleDeleteAttachment,
    handleBatchDeleteAttachment,
    handleFolderActionSuccess,
  };
}
