
import type { FolderItem } from './types';

export const formatBytes = (value?: number) => {
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

export const findFolderById = (
  nodes: API.sysAttachmentFolder[] = [],
  id: number,
): API.sysAttachmentFolder | undefined => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (Array.isArray(n.children) && n.children.length > 0) {
      const found = findFolderById(n.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

export const flattenFolders = (
  nodes: API.sysAttachmentFolder[] = [],
  prefix: string[] = [],
  level = 1,
  parentIds: number[] = [],
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
      list.push(
        ...flattenFolders(n.children, path, level + 1, [...parentIds, n.id]),
      );
    }
  }
  return list;
};

export const highlightText = (text: string, keyword: string) => {
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

export const getKindFromFile = (file: File) => {
  const mime = file.type || '';
  if (mime.startsWith('image/')) return 'image' as const;
  if (mime.startsWith('audio/')) return 'audio' as const;
  if (mime.startsWith('video/')) return 'video' as const;
  return 'other' as const;
};
