import {
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { App, Button, Grid, Modal, Slider, Space } from 'antd';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export type ImageCropperShape = 'rect' | 'round';

export type ImageCropperModalProps = {
  open: boolean;
  file: File | null;
  aspect?: number;
  shape?: ImageCropperShape;
  outputType?: string;
  outputQuality?: number;
  outputSize?: number;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
  onFileChange?: (file: File) => void;
  title?: string;
  canvasSize?: number;
  previewSize?: number;
};

const DEFAULT_OUTPUT_SIZE = 512;
const DEFAULT_CANVAS_SIZE = 400;
const DEFAULT_PREVIEW_SIZE = 104;

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });

const createCroppedFile = async ({
  imageSrc,
  area,
  file,
  outputType,
  outputQuality,
  outputSize,
}: {
  imageSrc: string;
  area: Area;
  file: File | null;
  outputType: string;
  outputQuality: number;
  outputSize: number;
}): Promise<File> => {
  const image = await loadImage(imageSrc);
  const side = Math.min(area.width, area.height);
  const sourceX = area.x + (area.width - side) / 2;
  const sourceY = area.y + (area.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('裁切失败：无法创建画布');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    sourceX,
    sourceY,
    side,
    side,
    0,
    0,
    outputSize,
    outputSize,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error('裁切失败：图片导出失败')),
      outputType,
      outputQuality,
    );
  });
  const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'cropped';
  const extension = outputType === 'image/png' ? 'png' : 'jpg';

  return new File([blob], `${baseName}.${extension}`, { type: outputType });
};

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  open,
  file,
  aspect = 1,
  shape = 'rect',
  outputType = 'image/jpeg',
  outputQuality = 0.92,
  outputSize = DEFAULT_OUTPUT_SIZE,
  canvasSize = DEFAULT_CANVAS_SIZE,
  previewSize = DEFAULT_PREVIEW_SIZE,
  onConfirm,
  onCancel,
  onFileChange,
  title,
}) => {
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const compact = !screens.sm;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewRequestRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [confirming, setConfirming] = useState(false);

  const workspaceSize = compact ? Math.min(320, canvasSize) : canvasSize;

  const clearPreview = useCallback(() => {
    previewRequestRef.current += 1;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewSrc(null);
  }, []);

  useEffect(() => {
    if (!open || !file) {
      setImageSrc(null);
      setCroppedAreaPixels(null);
      clearPreview();
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    clearPreview();

    return () => URL.revokeObjectURL(objectUrl);
  }, [clearPreview, file, open]);

  useEffect(() => () => clearPreview(), [clearPreview]);

  const updatePreview = useCallback(
    async (area: Area) => {
      if (!imageSrc) return;
      const requestId = ++previewRequestRef.current;
      try {
        const preview = await createCroppedFile({
          imageSrc,
          area,
          file,
          outputType,
          outputQuality,
          outputSize: previewSize * 2,
        });
        if (requestId !== previewRequestRef.current) return;
        const nextPreviewUrl = URL.createObjectURL(preview);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = nextPreviewUrl;
        setPreviewSrc(nextPreviewUrl);
      } catch {
        // The confirm action presents the actionable export error.
      }
    },
    [file, imageSrc, outputQuality, outputType, previewSize],
  );

  const handleCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  useEffect(() => {
    if (croppedAreaPixels) void updatePreview(croppedAreaPixels);
  }, [croppedAreaPixels, updatePreview]);

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      message.warning('图片仍在加载，请稍后再试');
      return;
    }

    setConfirming(true);
    try {
      const croppedFile = await createCroppedFile({
        imageSrc,
        area: croppedAreaPixels,
        file,
        outputType,
        outputQuality,
        outputSize,
      });
      onConfirm(croppedFile);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '裁切失败');
    } finally {
      setConfirming(false);
    }
  };

  const handleReupload = () => {
    if (!onFileChange) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (nextFile) onFileChange?.(nextFile);
  };

  return (
    <Modal
      open={open}
      title={title ?? '裁切图片'}
      onCancel={onCancel}
      destroyOnHidden
      width={compact ? 'calc(100vw - 32px)' : canvasSize + 224}
      styles={{ body: { padding: compact ? 12 : 16 } }}
      footer={
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={confirming} onClick={handleConfirm}>
            确认
          </Button>
        </Space>
      }
    >
      {imageSrc ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleFileChange}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: compact ? 'column' : 'row',
              gap: compact ? 20 : 28,
              alignItems: compact ? 'center' : 'flex-start',
            }}
          >
            <div
              style={{
                width: workspaceSize,
                height: workspaceSize,
                flexShrink: 0,
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 8,
                background: '#141414',
              }}
            >
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                cropShape={shape}
                showGrid={false}
                objectFit="cover"
                restrictPosition
                minZoom={1}
                maxZoom={3}
                zoomWithScroll
                roundCropAreaPixels
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                style={{
                  cropAreaStyle: {
                    border: '1px solid rgba(255, 255, 255, 0.82)',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.64)',
                  },
                }}
              />
            </div>

            <div
              style={{
                width: compact ? '100%' : 148,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: compact ? 'center' : 'flex-start',
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  textAlign: compact ? 'center' : 'left',
                }}
              >
                <div
                  style={{
                    marginBottom: 10,
                    color: 'rgba(0, 0, 0, 0.65)',
                    fontSize: 13,
                  }}
                >
                  头像预览
                </div>
                <div
                  style={{
                    width: previewSize,
                    height: previewSize,
                    overflow: 'hidden',
                    border: '1px solid #e8e8e8',
                    borderRadius: shape === 'round' ? '50%' : 8,
                    background: '#f5f5f5',
                  }}
                >
                  {previewSrc && (
                    <img
                      alt="裁切预览"
                      src={previewSrc}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    color: 'rgba(0, 0, 0, 0.45)',
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  保存后将用于个人资料展示
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
                color: 'rgba(0, 0, 0, 0.65)',
                fontSize: 13,
              }}
            >
              <ZoomOutOutlined />
              <span>缩放</span>
              <Slider
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={setZoom}
                tooltip={{ formatter: null }}
                style={{ flex: 1, minWidth: 120, margin: 0 }}
              />
              <ZoomInOutlined />
            </div>
            <Button
              type="link"
              icon={<UploadOutlined />}
              onClick={handleReupload}
            >
              重新上传
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>
          正在加载图片…
        </div>
      )}
    </Modal>
  );
};

export default ImageCropperModal;
