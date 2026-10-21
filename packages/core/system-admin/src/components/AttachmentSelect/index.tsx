import {
  FileOutlined,
  PictureOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useSystemAdmin } from '../../runtime';
import type { UploadFile, UploadProps } from 'antd';
import { App, Button, Flex, Image, Space, Typography, Upload } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AttachmentLibraryModal } from '../AttachmentLibraryModal';
import {
  normalizeAttachmentStoredValue,
  resolveAttachmentPublicUrl,
} from '../../utils/attachmentUpload';
import type {
  AttachmentKind,
  AttachmentSelectProps,
  AttachmentSelectValue,
  KindTab,
} from '../AttachmentLibraryModal/types';

const getKindFromFile = (file: File): AttachmentKind => {
  const mime = file.type || '';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'other';
};

const getAcceptByKind = (kind?: KindTab) => {
  if (kind === 'image') return 'image/*';
  if (kind === 'audio') return 'audio/*';
  if (kind === 'video') return 'video/*';
  return undefined;
};

const toArray = (value?: AttachmentSelectValue) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

export const AttachmentSelect: React.FC<AttachmentSelectProps> = ({
  value,
  onChange,
  kind = 'all',
  multiple = false,
  valueType = 'url',
  folderId,
  maxCount,
  disabled,
  beforeUpload,
  compact = false,
  uploadText = '上传图片',
}) => {
  const { message } = App.useApp();
  const { initialState } = useSystemAdmin();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const currentValues = useMemo(() => toArray(value), [value]);
  const modalSelectedValues = useMemo(() => {
    if (valueType !== 'url') return currentValues;
    const cfg = initialState?.cloudStorageConfig;
    return currentValues
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .map((v) => normalizeAttachmentStoredValue(String(v), cfg));
  }, [currentValues, initialState?.cloudStorageConfig, valueType]);

  useEffect(() => {
    if (valueType === 'url') {
      const cfg = initialState?.cloudStorageConfig;
      const list = currentValues
        .filter((v) => typeof v === 'string' && v.trim().length > 0)
        .map((v, idx) => {
          const stored = String(v);
          const url = resolveAttachmentPublicUrl(stored, cfg);
          const name = stored.split('/').pop() || 'file';
          return {
            uid: `attachment-${idx}`,
            name,
            status: 'done',
            url,
          } as UploadFile;
        });
      setFileList(list);
      return;
    }
    const list = currentValues.map((v, idx) => {
      const name = `ID:${String(v)}`;
      return { uid: `attachment-${idx}`, name, status: 'done' } as UploadFile;
    });
    setFileList(list);
  }, [currentValues, initialState?.cloudStorageConfig, valueType]);

  const emitValues = (next: Array<string | number>) => {
    if (multiple) {
      onChange?.(next);
      return;
    }
    onChange?.(next.length ? next[0] : undefined);
  };

  const accept = getAcceptByKind(kind);
  const listType: UploadProps['listType'] =
    kind === 'image' ? 'picture-card' : 'text';

  const handlePreview = useCallback(
    async (file: UploadFile) => {
      const raw = String(file.url || (file.preview as string) || '');
      const src = resolveAttachmentPublicUrl(
        raw,
        initialState?.cloudStorageConfig,
      );
      if (!src) return;
      setPreviewImage(src);
      setPreviewOpen(true);
    },
    [initialState?.cloudStorageConfig],
  );

  const customRequest: UploadProps['customRequest'] = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    setUploadError('');
    try {
      let f: File = file as File;
      if (beforeUpload) {
        const next = await beforeUpload(f);
        if (next === null) return;
        if (next) f = next;
      }
      const uploadKind: AttachmentKind =
        kind && kind !== 'all' ? (kind as AttachmentKind) : getKindFromFile(f);
      const upload = initialState?.uploadAttachmentFile;
      if (!upload) {
        setUploadError('上传能力未初始化');
        onError?.(new Error('上传能力未初始化'));
        return;
      }
      const res = await upload(f, {
        folderId,
        kind: uploadKind,
        dir: 'attachments',
      });
      if (!res.success) {
        setUploadError(res.message || '上传失败');
        onError?.(new Error(res.message || '上传失败'));
        return;
      }
      const items = (res.data || []) as any[];
      const nextValues = items
        .map((x: any) => {
          if (valueType === 'id') return x.id || 0;
          return x.path || x.url || '';
        })
        .filter((x: string | number) =>
          typeof x === 'string' ? x.trim().length > 0 : Number(x) > 0,
        );
      if (!nextValues.length) {
        setUploadError('上传成功但未返回可用地址');
        message.error('上传成功但未返回可用地址');
        onSuccess?.(res, file as any);
        return;
      }
      const merged = multiple
        ? [...currentValues, ...nextValues]
        : [nextValues[0]];
      emitValues(merged as Array<string | number>);
      onSuccess?.(res, file as any);
    } catch (e: any) {
      setUploadError(e instanceof Error ? e.message : '上传失败，请重试');
      if (e instanceof Error) message.error(e.message);
      onError?.(e);
    } finally {
      setUploading(false);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    listType,
    accept,
    fileList,
    customRequest,
    multiple,
    maxCount: multiple ? maxCount : 1,
    onPreview: kind === 'image' ? handlePreview : undefined,
    onRemove: (file) => {
      if (!multiple) {
        emitValues([]);
        return true;
      }
      const idx = fileList.findIndex((f) => f.uid === file.uid);
      if (idx < 0) return true;
      const next = currentValues.filter((_, i) => i !== idx) as Array<
        string | number
      >;
      emitValues(next);
      return true;
    },
    disabled,
  };

  return (
    <>
      {compact && !multiple ? (
        <Flex vertical gap={4} style={{ width: '100%', minWidth: 0 }}>
          <Flex align="center" gap={8} style={{ minHeight: 40 }}>
            {fileList[0]?.url && (
              <Image
                src={fileList[0].url}
                width={32}
                height={32}
                style={{ objectFit: 'cover' }}
              />
            )}
            <Upload
              {...uploadProps}
              listType="text"
              showUploadList={false}
              disabled={disabled || uploading}
            >
              <Button
                icon={currentValues.length ? undefined : <UploadOutlined />}
                loading={uploading}
                disabled={disabled}
              >
                {currentValues.length ? '更换' : uploadText}
              </Button>
            </Upload>
            {currentValues.length > 0 && (
              <Button
                type="text"
                disabled={disabled || uploading}
                onClick={() => emitValues([])}
              >
                删除
              </Button>
            )}
          </Flex>
          {uploadError && (
            <Typography.Text type="danger" role="alert">
              {uploadError}
            </Typography.Text>
          )}
        </Flex>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Upload {...uploadProps}>
              {kind === 'image' ? (
                fileList.length >=
                (multiple ? maxCount || Infinity : 1) ? null : (
                  <div style={{ border: 0, background: 'none' }}>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>上传</div>
                  </div>
                )
              ) : (
                <Button icon={<UploadOutlined />} disabled={disabled}>
                  上传
                </Button>
              )}
            </Upload>
            <Button
              icon={kind === 'image' ? <PictureOutlined /> : <FileOutlined />}
              onClick={() => setLibraryOpen(true)}
              disabled={disabled}
            >
              选择图片
            </Button>
          </Space>
        </Space>
      )}

      {previewImage && (
        <Image
          styles={{ root: { display: 'none' } }}
          preview={{
            src: previewImage,
            open: previewOpen,
            onOpenChange: (open) => {
              setPreviewOpen(open);
              if (!open) setPreviewImage('');
            },
          }}
        />
      )}

      {(!compact || multiple) && (
        <AttachmentLibraryModal
          open={libraryOpen}
          onCancel={() => setLibraryOpen(false)}
          kind={kind}
          multiple={multiple}
          valueType={valueType}
          initialFolderId={folderId}
          initialSelectedValues={
            (modalSelectedValues as Array<string | number>) || []
          }
          beforeUpload={beforeUpload}
          onSelect={(items) => {
            const next = items
              .map((a) => {
                const v =
                  valueType === 'id'
                    ? a.id
                    : a.objectKey || a.path || a.url || '';
                return v;
              })
              .filter((x) =>
                typeof x === 'string' ? x.trim().length > 0 : Number(x) > 0,
              );
            if (!next.length) {
              message.warning('未选择到可用素材');
              return;
            }
            const merged = multiple ? next : [next[0]];
            emitValues(merged as Array<string | number>);
            setLibraryOpen(false);
          }}
        />
      )}
    </>
  );
};

export const AttachmentSingleSelect: React.FC<
  Omit<AttachmentSelectProps, 'multiple'>
> = (props) => {
  return <AttachmentSelect {...props} multiple={false} />;
};

export const AttachmentMultiSelect: React.FC<
  Omit<AttachmentSelectProps, 'multiple'>
> = (props) => {
  return <AttachmentSelect {...props} multiple />;
};

export const AttachmentImageSelect: React.FC<
  Omit<AttachmentSelectProps, 'kind'>
> = (props) => {
  return <AttachmentSelect {...props} kind="image" />;
};

export const AttachmentAudioSelect: React.FC<
  Omit<AttachmentSelectProps, 'kind'>
> = (props) => {
  return <AttachmentSelect {...props} kind="audio" />;
};

export const AttachmentVideoSelect: React.FC<
  Omit<AttachmentSelectProps, 'kind'>
> = (props) => {
  return <AttachmentSelect {...props} kind="video" />;
};

export const AttachmentFileSelect: React.FC<
  Omit<AttachmentSelectProps, 'kind'>
> = (props) => {
  return <AttachmentSelect {...props} kind="other" />;
};
