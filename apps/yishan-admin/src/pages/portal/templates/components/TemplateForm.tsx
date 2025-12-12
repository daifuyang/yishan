import React, { useRef } from "react";
import { DrawerForm, ProFormText, ProFormTextArea, ProFormRadio, type ProFormInstance } from "@ant-design/pro-components";
import { useModel } from "@umijs/max";
import { createArticleTemplate, updateArticleTemplate } from "@/services/yishan-admin/portalArticles";
import { createPageTemplate, updatePageTemplate } from "@/services/yishan-admin/portalPages";

export interface TemplateFormProps {
  title: string;
  trigger?: JSX.Element;
  type: "article" | "page";
  initialValues?: Partial<API.portalTemplate>;
  onFinish?: () => Promise<void>;
}

const TemplateForm: React.FC<TemplateFormProps> = ({ title, trigger, type, initialValues = { status: "1", type }, onFinish }) => {
  const formRef = useRef<ProFormInstance>(null);
  const { initialState } = useModel("@@initialState");
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [
    { label: "禁用", value: "0" },
    { label: "启用", value: "1" },
  ];

  const handleFinish = async (values: any) => {
    const payload: any = {
      name: values.name,
      description: values.description,
      type,
      status: values.status,
    };

    if (!initialValues?.id) {
      const res = type === "article" ? await createArticleTemplate(payload as any) : await createPageTemplate(payload as any);
      if (res.success) { await onFinish?.(); return true; }
      return false;
    }
    const res = type === "article"
      ? await updateArticleTemplate({ id: Number(initialValues.id) }, payload as any)
      : await updatePageTemplate({ id: Number(initialValues.id) }, payload as any);
    if (res.success) { await onFinish?.(); return true; }
    return false;
  };

  return (
    <DrawerForm
      title={title}
      trigger={trigger}
      grid
      width={720}
      formRef={formRef}
      initialValues={initialValues}
      drawerProps={{ destroyOnClose: true, maskClosable: false }}
      onFinish={handleFinish}
    >
      <ProFormText name="name" label="模板名称" placeholder="请输入模板名称" colProps={{ span: 24 }} />
      <ProFormRadio.Group name="status" label="状态" options={defaultStatusDict} colProps={{ span: 24 }} />
      <ProFormTextArea name="description" label="模板描述" placeholder="请输入模板描述" colProps={{ span: 24 }} />
      {/** 结构与配置移至“配置结构”独立入口，此处不再展示 */}
    </DrawerForm>
  );
};

function safeParse(text: string) {
  try { return JSON.parse(text); } catch { return undefined; }
}

export default TemplateForm;
