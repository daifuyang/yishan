import {
  ModalForm,
  ProFormRadio,
  ProFormText,
  ProFormTreeSelect,
} from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import React, { useRef } from 'react';
import {
  getAttachmentDetail,
  getAttachmentFolderTree,
  updateAttachment,
} from '@/services/generated/attachments';
import type { Attachment, AttachmentFolder } from '@yishan/admin-sdk';

export interface AttachmentEditFormProps {
  title?: string;
  open: boolean;
  initialValues?: Partial<Attachment>;
  onFinish?: () => Promise<void>;
  onOpenChange?: (open: boolean) => void;
}

const topFolder: AttachmentFolder = {
  id: 0,
  name: '不选择分组',
  kind: 'all',
  status: '1',
  sort_order: 0,
  createdAt: '',
  updatedAt: '',
  children: [],
};

export const AttachmentEditForm: React.FC<AttachmentEditFormProps> = ({
  title = '编辑素材',
  open,
  initialValues,
  onFinish,
  onOpenChange,
}) => {
  const formRef = useRef<any>(undefined);
  const { initialState } = useModel('@@initialState');
  const statusOptions: Array<{ label: string; value: string }> =
    initialState?.dictDataMap?.default_status || [];

  return (
    <ModalForm
      formRef={formRef}
      width={520}
      title={title}
      open={open}
      modalProps={{ destroyOnClose: true, maskClosable: true }}
      autoFocusFirstInput
      grid
      onOpenChange={(open) => {
        onOpenChange?.(open);
        if (!open || !initialValues?.id) return;
        formRef.current?.setFieldsValue({
          ...initialValues,
          folderId: initialValues.folderId ?? 0,
          status: initialValues.status ?? '1',
        });
        void getAttachmentDetail({ id: Number(initialValues.id) })
          .then((res) => {
            if (!res.success || !res.data) return;
            formRef.current?.setFieldsValue({
              ...res.data,
              folderId: res.data.folderId ?? 0,
            });
          })
          .catch(() => undefined);
      }}
      onFinish={async (values) => {
        if (!initialValues?.id) return false;
        const res = await updateAttachment(
          { id: Number(initialValues.id) },
          {
            name: values.name ?? undefined,
            folderId: values.folderId === 0 ? null : Number(values.folderId),
            status: values.status as '0' | '1',
          },
        );
        if (!res.success) return false;
        await onFinish?.();
        return true;
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
        options={statusOptions.map((item) => ({
          label: item.label,
          value: item.value,
        }))}
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};
