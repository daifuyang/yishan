import React, { useRef } from 'react';
import {
  ModalForm,
  ProFormRadio,
  ProFormText,
  ProFormTreeSelect,
} from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import {
  getAttachmentDetail,
  getAttachmentFolderTree,
  updateAttachment,
} from '@/services/yishan-admin/attachments';

export interface AttachmentFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.sysAttachment>;
  onFinish?: () => Promise<void>;
}

const topFolder: API.sysAttachmentFolder = {
  id: 0,
  name: '不选择分组',
  kind: 'all',
  status: '1',
  sort_order: 0,
  createdAt: '',
  updatedAt: '',
  children: [],
};

const AttachmentForm: React.FC<AttachmentFormProps> = ({
  title,
  trigger,
  initialValues,
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
          getAttachmentDetail({ id: Number(initialValues.id) }).then((res) => {
            if (res.success && res.data) {
              formRef.current?.setFieldsValue({
                ...res.data,
                folderId: res.data.folderId ?? 0,
              });
            }
          });
        }
      }}
      onFinish={async (values) => {
        if (!initialValues?.id) return false;

        const payload: API.updateAttachmentReq = {
          name: values.name ?? undefined,
          folderId: values.folderId === 0 ? null : Number(values.folderId),
          status: values.status as '0' | '1',
        };
        const res = await updateAttachment({ id: Number(initialValues.id) }, payload);
        if (res.success) {
          await onFinish?.();
          return true;
        }
        return false;
      }}
    >
      <ProFormText
        name="name"
        label="素材名称"
        placeholder="请输入素材名称（可选）"
        rules={[{ max: 255, message: '最多255个字符' }]}
        colProps={{ span: 24 }}
      />

      <ProFormTreeSelect
        name="folderId"
        label="分组"
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

      <ProFormRadio.Group
        name="status"
        label="状态"
        rules={[{ required: true, message: '请选择状态' }]}
        options={defaultStatusDict.map((item) => ({ label: item.label, value: item.value }))}
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default AttachmentForm;
