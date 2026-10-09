/**
 * 这个文件作为组件的目录
 * 目的是统一管理对外输出的组件，方便分类
 */
/**
 * 布局组件
 */

import { AttachmentLibraryModal } from '@yishan/core-system-admin/components/AttachmentLibraryModal';
import {
  AttachmentAudioSelect,
  AttachmentFileSelect,
  AttachmentImageSelect,
  AttachmentMultiSelect,
  AttachmentSelect,
  AttachmentSingleSelect,
  AttachmentVideoSelect,
} from '@yishan/core-system-admin/components/AttachmentSelect';
/**
 * 部门树选择组件
 */
import { ProFormDeptTreeSelect } from '@yishan/core-system-admin/components/DeptTreeSelect';
import Footer from './Footer';
import QiniuUpload from '@yishan/core-system-admin/components/QiniuUpload';
import { ProFormRegionCascader } from '@yishan/core-system-admin/components/RegionCascader';
import { Question, SelectLang } from './RightContent';
import { AvatarDropdown, AvatarName } from './RightContent/AvatarDropdown';

export type { AttachmentLibraryModalProps } from '@yishan/core-system-admin/components/AttachmentLibraryModal/types';
export type {
  ImageCropperModalProps,
  ImageCropperShape,
} from '@yishan/core-system-admin/components/ImageCropperModal';
export { default as ImageCropperModal } from '@yishan/core-system-admin/components/ImageCropperModal';

export {
  AttachmentAudioSelect,
  AttachmentFileSelect,
  AttachmentImageSelect,
  AttachmentLibraryModal,
  AttachmentMultiSelect,
  AttachmentSelect,
  AttachmentSingleSelect,
  AttachmentVideoSelect,
  AvatarDropdown,
  AvatarName,
  Footer,
  ProFormDeptTreeSelect,
  ProFormRegionCascader,
  QiniuUpload,
  Question,
  SelectLang,
};
