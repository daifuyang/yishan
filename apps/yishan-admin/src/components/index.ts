/**
 * 这个文件作为组件的目录
 * 目的是统一管理对外输出的组件，方便分类
 */
/**
 * 布局组件
 */

import { AttachmentLibraryModal } from './AttachmentLibraryModal';
import {
  AttachmentAudioSelect,
  AttachmentFileSelect,
  AttachmentImageSelect,
  AttachmentMultiSelect,
  AttachmentSelect,
  AttachmentSingleSelect,
  AttachmentVideoSelect,
} from './AttachmentSelect';
/**
 * 部门树选择组件
 */
import { ProFormDeptTreeSelect } from './DeptTreeSelect';
import Footer from './Footer';
import QiniuUpload from './QiniuUpload';
import { ProFormRegionCascader } from './RegionCascader';
import { Question, SelectLang } from './RightContent';
import { AvatarDropdown, AvatarName } from './RightContent/AvatarDropdown';

export type { AttachmentLibraryModalProps } from './AttachmentLibraryModal/types';
export type {
  ImageCropperModalProps,
  ImageCropperShape,
} from './ImageCropperModal';
export { default as ImageCropperModal } from './ImageCropperModal';

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
