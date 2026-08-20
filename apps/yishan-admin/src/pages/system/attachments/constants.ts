export const attachmentKindMeta: Record<
  API.sysAttachment['kind'],
  { color: string; text: string }
> = {
  image: { color: 'blue', text: '图片' },
  audio: { color: 'purple', text: '音频' },
  video: { color: 'cyan', text: '视频' },
  other: { color: 'default', text: '其他' },
};

export const GRID_BREAKPOINTS = {
  sm: { max: 576, cols: 2 },
  md: { max: 768, cols: 3 },
  lg: { max: 992, cols: 4 },
  xl: { max: 1200, cols: 5 },
  xxl: { max: 1600, cols: 6 },
  max: { cols: 7 },
};
