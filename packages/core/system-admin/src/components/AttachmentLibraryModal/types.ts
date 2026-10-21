import type { Attachment } from '../../types/index';

export type AttachmentKind = Attachment['kind'];
export type KindTab = AttachmentKind | 'all';
export type ValueType = 'url' | 'id';

export type AttachmentSelectValue =
  | string
  | number
  | Array<string | number>
  | undefined;

export type AttachmentSelectProps = {
  value?: AttachmentSelectValue;
  onChange?: (value?: AttachmentSelectValue) => void;
  kind?: KindTab;
  multiple?: boolean;
  valueType?: ValueType;
  folderId?: number;
  maxCount?: number;
  disabled?: boolean;
  beforeUpload?: (file: File) => Promise<File | null | undefined>;
  /** 单附件使用行内上传与缩略图，隐藏重复的素材库入口。 */
  compact?: boolean;
  uploadText?: string;
};

export type AttachmentLibraryModalProps = {
  open: boolean;
  onCancel: () => void;
  onSelect: (items: Attachment[]) => void;
  kind?: KindTab;
  multiple?: boolean;
  valueType: ValueType;
  initialFolderId?: number;
  initialSelectedValues: Array<string | number>;
  beforeUpload?: (file: File) => Promise<File | null | undefined>;
};
