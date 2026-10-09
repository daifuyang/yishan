import type {} from '../../types/index';
export type FolderItem = {
  id: number;
  name: string;
  displayName: string;
  kind: SystemAPI.sysAttachmentFolder['kind'];
  level: number;
  parentIds: number[];
};
