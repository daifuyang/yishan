export type FolderItem = {
  id: number;
  name: string;
  displayName: string;
  kind: API.sysAttachmentFolder['kind'];
  level: number;
  parentIds: number[];
};
