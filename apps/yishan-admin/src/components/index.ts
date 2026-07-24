/**
 * 这个文件作为组件的目录
 * 目的是统一管理对外输出的组件，方便分类
 */
/**
 * 布局组件
 */
import Footer from "./Footer";
import { Question, SelectLang } from "./RightContent";
import { AvatarDropdown, AvatarName } from "./RightContent/AvatarDropdown";

/**
 * 部门树选择组件
 */
import { ProFormDeptTreeSelect } from "./DeptTreeSelect";
import { ProFormRegionCascader } from "./RegionCascader";
import QiniuUpload from "./QiniuUpload";
import {
  AttachmentSelect,
  AttachmentSingleSelect,
  AttachmentMultiSelect,
  AttachmentImageSelect,
  AttachmentAudioSelect,
  AttachmentVideoSelect,
  AttachmentFileSelect,
} from "./AttachmentSelect";

export { default as ImageCropperModal } from "./ImageCropperModal";
export type { ImageCropperShape, ImageCropperModalProps } from "./ImageCropperModal";

export {
  AvatarDropdown,
  AvatarName,
  Footer,
  Question,
  SelectLang,
  ProFormDeptTreeSelect,
  ProFormRegionCascader,
  QiniuUpload,
  AttachmentSelect,
  AttachmentSingleSelect,
  AttachmentMultiSelect,
  AttachmentImageSelect,
  AttachmentAudioSelect,
  AttachmentVideoSelect,
  AttachmentFileSelect,
};
