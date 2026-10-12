import type {} from '../../../types/index';
import React, { useMemo, useRef } from 'react';
import {
  ModalForm,
  ProFormDependency,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  ProFormText,
} from '@ant-design/pro-components';
import {
  createAppMenu,
  updateAppMenu,
} from '../../../services/generated/sysAppMenus';

type AppMenuFormValues = {
  name: string;
  type: 0 | 1;
  parentId?: number;
  icon?: string;
  page?: string;
  moduleId?: string;
  sortOrder?: number;
  status: '0' | '1';
};

export interface AppMenuFormProps {
  title: string;
  trigger?: React.JSX.Element;
  initialValues?: Partial<SystemAPI.appMenuNode>;
  groups: SystemAPI.appMenuNode[];
  onFinish?: () => Promise<void>;
}

const AppMenuForm: React.FC<AppMenuFormProps> = ({
  title,
  trigger,
  initialValues,
  groups,
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);

  const initialVals: Partial<AppMenuFormValues> = useMemo(
    () =>
      initialValues?.id
        ? {
            name: initialValues.name,
            type: (initialValues.type ?? 1) as 0 | 1,
            parentId: initialValues.parentId,
            icon: initialValues.icon,
            page: initialValues.page,
            moduleId: initialValues.moduleId ?? 'core',
            sortOrder: initialValues.sortOrder,
            status: initialValues.status ?? '1',
          }
        : {
            type: 1,
            parentId: initialValues?.parentId,
            moduleId: 'core',
            status: '1',
          },
    [initialValues],
  );

  if (!trigger) return null;

  return (
    <ModalForm<AppMenuFormValues>
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      grid
      formRef={formRef}
      initialValues={initialVals}
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      onFinish={async (values) => {
        const payload: SystemAPI.saveAppMenuReq = {
          name: values.name,
          type: values.type,
          parentId: values.type === 0 ? undefined : values.parentId,
          icon: values.icon,
          page: values.type === 0 ? undefined : values.page,
          moduleId: values.moduleId || 'core',
          sortOrder: values.sortOrder,
          status: values.status,
        };
        const res = initialValues?.id
          ? await updateAppMenu(
              { id: String(initialValues.id) },
              payload as SystemAPI.updateAppMenuReq,
            )
          : await createAppMenu(payload);
        if (!res.success) return false;
        await onFinish?.();
        return true;
      }}
    >
      <ProFormRadio.Group
        name="type"
        label="类型"
        colProps={{ span: 24 }}
        disabled={!!initialValues?.id && (initialValues.children?.length ?? 0) > 0}
        options={[
          { label: '分组', value: 0 },
          { label: '应用入口', value: 1 },
        ]}
        rules={[{ required: true, message: '请选择类型' }]}
      />
      <ProFormDependency name={['type']}>
        {({ type }: { type?: 0 | 1 }) => (
          <>
            {type === 1 && (
              <ProFormSelect
                name="parentId"
                label="所属分组"
                colProps={{ span: 24 }}
                options={groups.map((group) => ({
                  label: group.name,
                  value: group.id,
                }))}
                rules={[{ required: true, message: '请选择所属分组' }]}
              />
            )}
            <ProFormText
              name="name"
              label="名称"
              colProps={{ span: 12 }}
              rules={[
                { required: true, message: '请输入名称' },
                { max: 100, message: '最多100个字符' },
              ]}
            />
            <ProFormText
              name="icon"
              label="图标名"
              colProps={{ span: 12 }}
              placeholder="如 contacts，对应 App 内图标"
            />
            {type === 1 && (
              <>
                <ProFormText
                  name="page"
                  label="App 页面路径"
                  colProps={{ span: 24 }}
                  placeholder="如 pages/contacts/index/index"
                  tooltip="需与 App 内已注册的页面一致；未注册的页面不会在 App 中展示"
                  rules={[
                    { required: true, message: '请输入 App 页面路径' },
                    {
                      pattern: /^pages\/[\w\-/]+$/,
                      message: '形如 pages/contacts/index/index',
                    },
                  ]}
                />
                <ProFormText
                  name="moduleId"
                  label="所属模块"
                  colProps={{ span: 12 }}
                  tooltip="系统功能为 core；模块功能填模块 ID，模块停用后入口自动隐藏"
                />
              </>
            )}
          </>
        )}
      </ProFormDependency>
      <ProFormDigit
        name="sortOrder"
        label="排序"
        colProps={{ span: 12 }}
        tooltip="同级按数值升序，留空则排在末尾；也可使用列表的上移/下移"
        fieldProps={{ min: 0, precision: 0 }}
      />
      <ProFormRadio.Group
        name="status"
        label="状态"
        colProps={{ span: 12 }}
        options={[
          { label: '启用', value: '1' },
          { label: '禁用', value: '0' },
        ]}
        rules={[{ required: true, message: '请选择状态' }]}
      />
    </ModalForm>
  );
};

export default AppMenuForm;
