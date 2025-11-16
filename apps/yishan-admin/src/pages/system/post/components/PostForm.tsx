import React, { useEffect } from 'react';
import { Form, Input, Radio, Modal } from 'antd';
import type { FormInstance } from 'antd';

export interface PostFormProps {
  form: FormInstance;
  open: boolean;
  title: string;
  initialValues?: API.sysPost;
  onCancel: () => void;
  onSubmit: (values: API.savePostReq | API.updatePostReq) => Promise<void>;
  confirmLoading: boolean;
}

const PostForm: React.FC<PostFormProps> = ({
  form,
  open,
  title,
  initialValues,
  onCancel,
  onSubmit,
  confirmLoading,
}) => {
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: API.savePostReq = {
        name: values.name,
        status: values.status,
        sort_order: Number(values.sort_order ?? 0),
        description: values.description,
      };
      await onSubmit(payload);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue({
          name: initialValues.name,
          status: initialValues.status ?? 1,
          sort_order: initialValues.sort_order ?? 0,
          description: initialValues.description,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status: 1, sort_order: 0 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={confirmLoading}
      maskClosable={false}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="name"
          label="岗位名称"
          rules={[{ required: true, message: '请输入岗位名称' }, { max: 50, message: '最多50个字符' }]}
        >
          <Input placeholder="请输入岗位名称" />
        </Form.Item>

        

        <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
          <Radio.Group>
            <Radio value={1}>启用</Radio>
            <Radio value={0}>禁用</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="sort_order" label="排序" rules={[{ required: true, message: '请输入排序值' }]}>
          <Input type="number" placeholder="请输入排序值" />
        </Form.Item>

        <Form.Item name="description" label="岗位描述" rules={[{ max: 200, message: '最多200个字符' }]}>
          <Input.TextArea rows={3} placeholder="请输入岗位描述（可选）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PostForm;