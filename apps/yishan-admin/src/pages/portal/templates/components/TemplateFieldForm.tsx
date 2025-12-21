import React, { useRef } from "react";
import {
  ModalForm,
  ProFormText,
  ProFormSelect,
  ProFormSwitch,
  ProFormList,
  ProFormDependency,
  ProFormGroup,
} from "@ant-design/pro-components";

const FIELD_TYPES = [
  { label: "输入框", value: "input" },
  { label: "文本域", value: "textarea" },
  { label: "单选", value: "radio" },
  { label: "多选", value: "checkbox" },
  { label: "下拉选择", value: "select" },
  { label: "数字", value: "number" },
  { label: "开关", value: "switch" },
  { label: "日期", value: "date" },
  { label: "日期时间", value: "datetime" },
];

export interface TemplateFieldFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: any;
  onSubmit?: (field: any) => Promise<boolean> | boolean;
}

const TemplateFieldForm: React.FC<TemplateFieldFormProps> = ({
  title,
  trigger,
  initialValues,
  onSubmit,
}) => {
  const formRef = useRef<any>(undefined);

  const handleFinish = async (values: any) => {
    const field = {
      label: values.label,
      name: values.name,
      type: values.type,
      required: values.required ?? false,
      props: values.props ?? {},
      options: values.options ?? [],
    };
    const ok = (await onSubmit?.(field)) ?? true;
    return ok;
  };

  return (
    <ModalForm
      title={title}
      trigger={trigger}
      formRef={formRef}
      grid
      initialValues={initialValues}
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      onFinish={handleFinish}
    >
      <ProFormText
        name="label"
        label="显示名称"
        placeholder="如：姓名"
        colProps={{ span: 12 }}
        rules={[{ required: true, message: "请输入显示名称" }]}
      />
      <ProFormText
        name="name"
        label="字段标识"
        placeholder="如：name"
        colProps={{ span: 12 }}
        rules={[{ required: true, message: "请输入字段标识" }]}
      />
      <ProFormSelect
        name="type"
        label="组件类型"
        options={FIELD_TYPES}
        colProps={{ span: 12 }}
        rules={[{ required: true, message: "请选择组件类型" }]}
      />
      <ProFormSwitch name="required" label="必填" colProps={{ span: 12 }} />

      {/* 常用属性 */}
      <ProFormText
        name={["props", "placeholder"]}
        label="占位提示"
        colProps={{ span: 24 }}
      />
      <ProFormText
        name={["props", "maxLength"]}
        label="最大长度"
        colProps={{ span: 8 }}
      />
      <ProFormText
        name={["props", "min"]}
        label="最小值"
        colProps={{ span: 8 }}
      />
      <ProFormText
        name={["props", "max"]}
        label="最大值"
        colProps={{ span: 8 }}
      />

      {/* 选项配置（用于单选/复选/下拉），动态显示且必填 */}
      <ProFormDependency name={["type"]}>
        {({ type }) => {
          const needOptions = ["radio", "checkbox", "select"].includes(
            type as string
          );
          if (!needOptions) return null;
          return (
            <ProFormList
              name="options"
              label="选项"
              creatorButtonProps={{ creatorButtonText: "新增选项" }}
              rules={[
                {
                  validator: async (_, value) => {
                    if (!Array.isArray(value) || value.length < 1) {
                      throw new Error("请至少添加一个选项");
                    }
                  },
                },
              ]}
            >
              <ProFormGroup>
                <ProFormText
                  name="label"
                  label="文本"
                  colProps={{ span: 12 }}
                  rules={[{ required: true, message: "请输入选项文本" }]}
                />
                <ProFormText
                  name="value"
                  label="值"
                  colProps={{ span: 12 }}
                  rules={[{ required: true, message: "请输入选项值" }]}
                />
              </ProFormGroup>
            </ProFormList>
          );
        }}
      </ProFormDependency>
    </ModalForm>
  );
};

export default TemplateFieldForm;
