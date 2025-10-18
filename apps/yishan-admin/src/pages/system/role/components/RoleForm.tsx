import React, { useEffect } from 'react';
import { Form, Input, Radio, Select, Modal } from 'antd';
import type { FormInstance } from 'antd';

export interface RoleFormProps {
  form: FormInstance;
  open: boolean;
  title: string;
  initialValues?: API.sysRole;
  onCancel: () => void;
  onSubmit: (values: API.sysRoleCreateRequest) => Promise<void>;
  confirmLoading: boolean;
}

/**
 * 角色表单组件
 */
const RoleForm: React.FC<RoleFormProps> = ({
  form,
  open,
  title,
  initialValues,
  onCancel,
  onSubmit,
  confirmLoading,
}) => {
  /**
   * 表单提交处理
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await onSubmit(values);
    } catch (error) {
      // 表单验证失败
    }
  };

  /**
   * Modal 打开后的处理
   */
  const handleAfterOpenChange = (open: boolean) => {
    if (open) {
      if (initialValues) {
        // 编辑模式：设置表单值
        form.setFieldsValue(initialValues);
      } else {
        // 新增模式：重置表单并设置默认值
        form.resetFields();
        form.setFieldsValue({ status: 1, isSystem: 0, sortOrder: 0 });
      }
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={confirmLoading}
      maskClosable={false}
      destroyOnHidden={true}
      afterOpenChange={handleAfterOpenChange}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
      >
        <Form.Item
          name="roleName"
          label="角色名称"
          rules={[
            { required: true, message: '请输入角色名称' },
            { max: 50, message: '角色名称最多50个字符' },
          ]}
        >
          <Input placeholder="请输入角色名称" />
        </Form.Item>

        <Form.Item
          name="sortOrder"
          label="排序顺序"
          rules={[
            { required: true, message: '请输入排序顺序' },
          ]}
        >
          <Input type="number" placeholder="请输入排序顺序" />
        </Form.Item>

        <Form.Item
          name="isSystem"
          label="角色类型"
          rules={[{ required: true, message: '请选择角色类型' }]}
        >
          <Radio.Group>
            <Radio value={1}>系统角色</Radio>
            <Radio value={0}>自定义角色</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="status"
          label="角色状态"
          rules={[{ required: true, message: '请选择角色状态' }]}
        >
          <Radio.Group>
            <Radio value={1}>启用</Radio>
            <Radio value={0}>禁用</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          name="roleDesc"
          label="角色描述"
          rules={[{ max: 200, message: '描述最多200个字符' }]}
        >
          <Input.TextArea rows={4} placeholder="请输入角色描述" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoleForm;