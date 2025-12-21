import React, { useRef } from 'react';
import { ModalForm, ProFormText, ProFormRadio, ProFormDigit, ProFormTextArea, ProFormTreeSelect } from '@ant-design/pro-components';
import { getDeptTree, createDept, updateDept, getDeptDetail } from '@/services/yishan-admin/sysDepts';
import { useModel } from '@umijs/max';

export interface DepartmentFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.sysDept>;
  onFinish?: () => Promise<void>;
}

const topDepartment = {
  id: 0,
  name: '顶级部门',
  status: '1' as '0' | '1',
  sort_order: 0,
  createdAt: '',
  updatedAt: '',
  children: []
}

const DepartmentForm: React.FC<DepartmentFormProps> = ({
  title,
  trigger,
  initialValues = {
    parentId: 0,
    status: '1'
  },
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
            getDeptDetail({ id: Number(initialValues.id) }).then((res) => {
              if (res.success && res.data) {
                formRef.current?.setFieldsValue(res.data as any);
              }
            });
          }
        }}
        onFinish={async (values) => {
          const basePayload: API.createDeptReq = {
            name: values.name || '',
            parentId: values.parentId === 0 ? undefined : values.parentId,
            status: values.status,
            sort_order: Number(values.sort_order ?? 0),
            description: values.description,
            leaderId: values.leaderId ? Number(values.leaderId) : undefined,
          };
          if (!initialValues?.id) {
            const res = await createDept(basePayload);
            if (res.success) {
              await onFinish?.();
              return true;
            }
            return false;
          }
          const updatePayload: API.updateDeptReq = { ...basePayload };
          const res = await updateDept({ id: Number(initialValues.id) }, updatePayload);
          if (res.success) {
            await onFinish?.();
            return true;
          }
          return false;
        }}
      >
      <ProFormTreeSelect
        name="parentId"
        label="上级部门"
        rules={[{ required: true, message: '请选择上级部门' }]}
        colProps={{ span: 24 }}
        request={async () => {
          try {
            const response = await getDeptTree();
            return [topDepartment, ...(response.data || [])];
          } catch {
            return [topDepartment];
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
        label="部门名称"
        placeholder="请输入部门名称"
        rules={[{ required: true, message: '请输入部门名称' }, { max: 50, message: '最多50个字符' }]}
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
        name="description"
        label="部门描述"
        rules={[{ max: 200, message: '最多200个字符' }]}
        fieldProps={{ rows: 3, placeholder: '请输入部门描述（可选）' }}
        colProps={{ span: 24 }}
      />

      <ProFormDigit
        name="leaderId"
        label="负责人ID"
        placeholder="请输入负责人用户ID（可选）"
        colProps={{ span: 24 }}
      />
    </ModalForm>
  );
};

export default DepartmentForm;
