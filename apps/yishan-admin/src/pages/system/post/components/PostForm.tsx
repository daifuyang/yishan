import React, { useRef } from 'react';
import { ModalForm, ProFormText, ProFormRadio, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { useModel } from '@umijs/max';
import { getPostDetail, createPost, updatePost } from '@/services/yishan-admin/sysPosts';

export interface PostFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.sysPost>;
  onFinish?: () => Promise<void>;
}

const PostForm: React.FC<PostFormProps> = ({
  title,
  trigger,
  initialValues = { status: '1', sort_order: 0 },
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);

  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];

  const fetchDetail = async (id: number) => {
    const res = await getPostDetail({ id: String(id) });
    if (res.success && res.data) {
      formRef.current?.setFieldsValue(res.data);
    }
  };

  if (!trigger) return null;

  return (
    <ModalForm
      width={520}
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      grid
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      onOpenChange={(open) => {
        if (open && initialValues?.id) {
          fetchDetail(Number(initialValues.id));
        }
      }}
      onFinish={async (values) => {
        const basePayload: API.savePostReq = {
          name: values.name,
          status: values.status,
          sort_order: Number(values.sort_order ?? 0),
          description: values.description,
        };
        if (!initialValues?.id) {
          const res = await createPost(basePayload);
          if (res.success) {
            await onFinish?.();
            return true;
          }
          return false;
        }
        const res = await updatePost({ id: String(initialValues.id) }, basePayload as API.updatePostReq);
        if (res.success) {
          await onFinish?.();
          return true;
        }
        return false;
      }}
    >
      <ProFormText
        name="name"
        label="岗位名称"
        placeholder="请输入岗位名称"
        rules={[{ required: true, message: '请输入岗位名称' }, { max: 50, message: '最多50个字符' }]}
        colProps={{ span: 24 }}
      />

      <ProFormRadio.Group
        name="status"
        label="状态"
        options={defaultStatusDict}
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
        name="description"
        label="岗位描述"
        fieldProps={{ rows: 3, placeholder: '请输入岗位描述（可选）' }}
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default PostForm;
