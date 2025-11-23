import React, { useRef } from "react";
import { ModalForm, ProFormText, ProFormTextArea, ProFormRadio, ProFormDateTimePicker, ProFormList, type ProFormInstance } from "@ant-design/pro-components";
import { useModel } from "@umijs/max";
import { getPageDetail, createPage, updatePage } from "@/services/yishan-admin/portalPages";
import dayjs from "dayjs";

export interface PageFormProps {
  title: string;
  trigger: React.ReactNode;
  initialValues?: Partial<API.portalPage>;
  onFinish?: () => Promise<void>;
}

const PageForm: React.FC<PageFormProps> = ({ title, trigger, initialValues = { status: "1" }, onFinish }) => {
  const { initialState } = useModel("@@initialState");
  const dictDataMap = initialState?.dictDataMap || {};
  const defaultStatusDict: Array<{ label: string; value: string }> = dictDataMap.default_status || [];
  const formRef = useRef<ProFormInstance>(null);

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
    }
  };

  const handleFinish = async (values: any) => {
    const attrs: Record<string, any> = Array.isArray(values.attributesList)
      ? (values.attributesList as Array<{ key: string; value: string }>).reduce((acc, cur) => {
          const k = String(cur.key || "").trim();
          if (k.length > 0) acc[k] = cur.value;
          return acc;
        }, {} as Record<string, any>)
      : values.attributes;

    const basePayload: any = {
      title: values.title,
      path: values.path,
      content: values.content,
      status: values.status,
      publishTime: values.publishTime,
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
