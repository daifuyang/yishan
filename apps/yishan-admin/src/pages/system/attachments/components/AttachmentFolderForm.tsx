import React, { useRef } from 'react';
import {
  ModalForm,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormTreeSelect,
} from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  createAttachmentFolder,
  getAttachmentFolderDetail,
  getAttachmentFolderTree,
  updateAttachmentFolder,
} from '@/services/yishan-admin/attachments';

export interface AttachmentFolderFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.sysAttachmentFolder>;
  onFinish?: () => Promise<void>;
}

type AttachmentFolderKind = API.sysAttachmentFolder['kind'];

const topFolder: API.sysAttachmentFolder = {
  id: 0,
  name: '顶级分组',
  kind: 'all',
  status: '1',
  sort_order: 0,
  createdAt: '',
  updatedAt: '',
  children: [],
};

const kindOptions: Array<{ label: string; value: AttachmentFolderKind }> = [
  { label: '全部', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '音频', value: 'audio' },
  { label: '视频', value: 'video' },
  { label: '其他', value: 'other' },
];

const AttachmentFolderForm: React.FC<AttachmentFolderFormProps> = ({
  title,
  trigger,
  initialValues = { parentId: 0, kind: 'all', status: '1', sort_order: 0 },
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  if (!trigger) return null;

  return (
    <ModalForm
      formRef={formRef}
      width={520}
      title={title}
      trigger={trigger}
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      autoFocusFirstInput
      grid
      initialValues={initialValues}
      onOpenChange={(open) => {
        if (open && initialValues?.id) {
          getAttachmentFolderDetail({ id: Number(initialValues.id) }).then((res) => {
            if (res.success && res.data) {
              formRef.current?.setFieldsValue({
                ...res.data,
                parentId: res.data.parentId ?? 0,
              });
            }
          });
        }
      }}
      onFinish={async (values) => {
        const payload: API.createAttachmentFolderReq = {
          name: values.name || '',
          parentId: values.parentId === 0 ? undefined : Number(values.parentId),
          kind: values.kind as AttachmentFolderKind,
          status: values.status as '0' | '1',
          sort_order: Number(values.sort_order ?? 0),
          remark: values.remark,
        };

        if (!initialValues?.id) {
          const res = await createAttachmentFolder(payload);
          if (res.success) {
            await onFinish?.();
            return true;
          }
          return false;
        }

        const updatePayload: API.updateAttachmentFolderReq = { ...payload };
        const res = await updateAttachmentFolder({ id: Number(initialValues.id) }, updatePayload);
        if (res.success) {
          await onFinish?.();
          return true;
        }
        return false;
      }}
    >
      <ProFormTreeSelect
        name="parentId"
        label="上级分组"
        rules={[{ required: true, message: '请选择上级分组' }]}
        colProps={{ span: 24 }}
        request={async () => {
          try {
            const response = await getAttachmentFolderTree();
            return [topFolder, ...(response.data || [])];
          } catch {
            return [topFolder];
          }
        }}
        fieldProps={{
          fieldNames: { label: 'name', value: 'id', children: 'children' },
          allowClear: true,
          treeDefaultExpandAll: true,
          style: { width: '100%' },
          showSearch: true,
        }}
      />

      <ProFormText
        name="name"
        label="分组名称"
        placeholder="请输入分组名称"
        rules={[{ required: true, message: '请输入分组名称' }, { max: 100, message: '最多100个字符' }]}
        colProps={{ span: 24 }}
      />

      <ProFormSelect
        name="kind"
        label="分组类型"
        options={kindOptions}
        rules={[{ required: true, message: '请选择分组类型' }]}
        colProps={{ span: 24 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        rules={[{ required: true, message: '请选择状态' }]}
        options={defaultStatusDict.map((item) => ({ label: item.label, value: item.value }))}
        colProps={{ span: 24 }}
      />

      <ProFormDigit
        name="sort_order"
        label="排序"
        placeholder="请输入排序值"
        rules={[{ required: true, message: '请输入排序值' }]}
        fieldProps={{ min: 0 }}
        colProps={{ span: 24 }}
      />

      <ProFormTextArea
        name="remark"
        label="备注"
        rules={[{ max: 255, message: '最多255个字符' }]}
        fieldProps={{ rows: 3, placeholder: '请输入备注（可选）' }}
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default AttachmentFolderForm;

