import React, { useRef } from "react";
import { ModalForm, ProFormText, ProFormTextArea, ProFormRadio, ProFormDateTimePicker, ProFormList, ProFormSelect, type ProFormInstance } from "@ant-design/pro-components";
import { useModel } from "@umijs/max";
import { getPageDetail, createPage, updatePage, getPageTemplateList, getPageTemplateSchema } from "@/services/yishan-admin/portalPages";
import dayjs from "dayjs";
import TemplateDynamicFields from "../../templates/components/TemplateDynamicFields";

export interface PageFormProps {
  title: string;
  trigger: JSX.Element;
  initialValues?: Partial<API.portalPage>;
  onFinish?: () => Promise<void>;
}

const PageForm: React.FC<PageFormProps> = ({ title, trigger, initialValues = { status: "1" }, onFinish }) => {
  const { initialState } = useModel("@@initialState");
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];
  const formRef = useRef<ProFormInstance>(null);
  const [templateFields, setTemplateFields] = React.useState<any[]>([]);

  const fetchDetail = async (id: number) => {
    const res = await getPageDetail({ id });
    if (res.success && res.data) {
      const d: any = res.data;
      const attributesList = d.attributes ? Object.entries(d.attributes).map(([k, v]) => ({ key: k, value: String(v) })) : [];
      formRef.current?.setFieldsValue({
        ...d,
        publishTime: d.publishTime ? dayjs(d.publishTime) : undefined,
        attributesList,
      });
      let fields: any[] = Array.isArray(d.templateSchema) ? d.templateSchema : [];
      if ((!fields || fields.length === 0) && d.templateId) {
        const schemaRes = await getPageTemplateSchema({ id: d.templateId });
        fields = Array.isArray(schemaRes?.data) ? schemaRes.data : [];
      }
      setTemplateFields(fields);
      if (fields.length > 0 && d.attributes) {
        const dynVals: Record<string, any> = {};
        for (const f of fields) {
          const n = (f?.name || '').trim();
          if (n && d.attributes && Object.prototype.hasOwnProperty.call(d.attributes, n)) {
            dynVals[n] = d.attributes[n];
          }
        }
        if (Object.keys(dynVals).length > 0) formRef.current?.setFieldsValue(dynVals);
      }
    }
  };

  const handleFinish = async (values: any) => {
    let attrs: Record<string, any> = {};
    if (Array.isArray(templateFields) && templateFields.length > 0) {
      for (const f of templateFields) {
        const n = (f?.name || '').trim();
        if (!n) continue;
        if (values.hasOwnProperty(n)) {
          attrs[n] = values[n];
        }
      }
    } else if (values.attributes) {
      attrs = values.attributes as Record<string, any>;
    }

    const basePayload: any = {
      title: values.title,
      path: values.path,
      content: values.content,
      status: values.status,
      publishTime: values.publishTime,
      templateId: values.templateId ?? initialValues?.templateId,
      attributes: attrs,
    };
    if (!initialValues?.id) {
      const res = await createPage(basePayload as API.createPageReq);
      if (res.success) { await onFinish?.(); return true; }
      return false;
    }
    const res = await updatePage({ id: Number(initialValues.id) }, basePayload as API.updatePageReq);
    if (res.success) { await onFinish?.(); return true; }
    return false;
  };

  return (
    <ModalForm
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      grid
      formRef={formRef}
      initialValues={initialValues}
      modalProps={{ destroyOnClose: true, maskClosable: false }}
      onOpenChange={(o) => { if (o && initialValues?.id) fetchDetail(initialValues.id); }}
      onFinish={handleFinish}
    >
      <ProFormText name="title" label="页面标题" placeholder="请输入页面标题" colProps={{ span: 12 }} />
      <ProFormText name="path" label="页面路径" placeholder="请输入页面路径" colProps={{ span: 12 }} />
      <ProFormRadio.Group name="status" label="状态" options={defaultStatusDict} colProps={{ span: 12 }} />
      <ProFormDateTimePicker
        name="publishTime"
        label="发布时间"
        colProps={{ span: 12 }}
        fieldProps={{ style: { width: "100%" } }}
        transform={(v: any) => {
          if (!v) return { publishTime: undefined };
          if (typeof v === "string") return { publishTime: v };
          if (typeof v === "number") return { publishTime: dayjs(v).format("YYYY-MM-DD HH:mm:ss") };
          if (v && typeof v === "object" && typeof v.format === "function") return { publishTime: v.format("YYYY-MM-DD HH:mm:ss") };
          return { publishTime: dayjs(v).format("YYYY-MM-DD HH:mm:ss") };
        }}
      />
      <ProFormTextArea name="content" label="页面内容" placeholder="请输入页面内容" colProps={{ span: 24 }} fieldProps={{ autoSize: { minRows: 6 } }} />

      <ProFormSelect
        name="templateId"
        label="模板"
        placeholder="请选择页面模板"
        showSearch
        initialValue={2}
        debounceTime={200}
        request={async (params: { keyWords?: string }) => {
          const res = await getPageTemplateList({ page: 1, pageSize: 50, status: "1", keyword: params.keyWords });
          const options = (res.data || []).map((t: API.portalTemplate) => ({ label: t.name, value: t.id }));
          return options;
        }}
        colProps={{ span: 24 }}
      />


      {/* 扩展区：动态模板字段渲染，位于表单底部 */}
      {Array.isArray(templateFields) && templateFields.length > 0 && (
        <TemplateDynamicFields fields={templateFields} title="扩展" />
      )}

      <ProFormList
        name="attributesList"
        label="自定义属性"
        creatorButtonProps={{ position: "bottom", creatorButtonText: "新增属性" }}
      >
        {(f) => (
          <>
            <ProFormText name={[f.name, "key"]} label="键" colProps={{ span: 12 }} />
            <ProFormText name={[f.name, "value"]} label="值" colProps={{ span: 12 }} />
          </>
        )}
      </ProFormList>
    </ModalForm>
  );
};

export default PageForm;
