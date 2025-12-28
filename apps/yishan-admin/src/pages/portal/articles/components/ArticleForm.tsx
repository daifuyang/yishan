import React, { useRef } from "react";
import {
  DrawerForm,
  ProFormText,
  ProFormTextArea,
  ProFormRadio,
  ProFormSwitch,
  ProFormDateTimePicker,
  ProFormSelect,
  ProForm,
} from "@ant-design/pro-components";
import { FormEditor, type ImageInsertItem, type ImageUploadAdapter } from "yishan-tiptap";
import dayjs from "dayjs";
import {
  getArticleDetail,
  createArticle,
  updateArticle,
} from "@/services/yishan-admin/portalArticles";
import { getCategoryList } from "@/services/yishan-admin/portalCategories";
import { Col, Divider } from "antd";
import { AttachmentImageSelect } from "@/components";
import TemplateDynamicFields from "../../templates/components/TemplateDynamicFields";
import { useModel } from "@umijs/max";
import { resolveAttachmentPublicUrl } from "@/utils/attachmentUpload";
import { AttachmentLibraryModal } from "@/components/AttachmentSelect";

export interface ArticleFormProps {
  title: string;
  trigger?: JSX.Element;
  initialValues?: Partial<API.portalArticle>;
  onFinish?: () => Promise<void>;
}

const ArticleForm: React.FC<ArticleFormProps> = ({
  title,
  trigger,
  initialValues = { status: "0", isPinned: false },
  onFinish,
}) => {
  const formRef = useRef<any>(undefined);
  const [templateFields, setTemplateFields] = React.useState<any[]>([]);
  const { initialState } = useModel("@@initialState");
  const [imageLibraryOpen, setImageLibraryOpen] = React.useState(false);
  const [imageLibraryMultiple, setImageLibraryMultiple] = React.useState(true);
  const pickResolveRef = React.useRef<
    ((items: ImageInsertItem[]) => void) | undefined
  >(undefined);
  const pickRejectRef = React.useRef<((reason?: any) => void) | undefined>(
    undefined
  );

  const imageUploadAdapter: ImageUploadAdapter = React.useMemo(
    () => ({
      upload: async (
        file: File,
        onProgress?: (event: { progress: number }) => void,
        abortSignal?: AbortSignal
      ) => {
        if (abortSignal?.aborted) {
          throw new Error("Upload cancelled");
        }
        const upload = initialState?.uploadAttachmentFile;
        if (!upload) {
          throw new Error("上传能力未初始化");
        }
        const res = await upload(file, { kind: "image", dir: "attachments" });
        if (!res.success) {
          throw new Error(res.message || "上传失败");
        }
        const item = (res.data || [])[0] as
          | API.uploadAttachmentsResp["data"][number]
          | undefined;
        const stored = String(item?.path || item?.url || "");
        const url = resolveAttachmentPublicUrl(
          stored,
          initialState?.cloudStorageConfig
        );
        if (!url) {
          throw new Error("上传成功但未返回可用地址");
        }
        onProgress?.({ progress: 100 });
        return url;
      },
      pick: async (options) => {
        if (pickRejectRef.current) {
          pickRejectRef.current(new Error("replaced"));
        }

        setImageLibraryMultiple(options?.multiple ?? true);
        setImageLibraryOpen(true);

        return await new Promise<ImageInsertItem[]>((resolve, reject) => {
          pickResolveRef.current = resolve;
          pickRejectRef.current = reject;
        });
      },
    }),
    [initialState]
  );

  const fetchDetail = async (id: number) => {
    const res = await getArticleDetail({ id });
    if (res.success && res.data) {
      const d: any = res.data;
      const attributesList = d.attributes
        ? Object.entries(d.attributes).map(([k, v]) => ({
            key: k,
            value: String(v),
          }))
        : [];
      formRef.current?.setFieldsValue({
        ...d,
        publishTime: d.publishTime ? dayjs(d.publishTime) : undefined,
        attributesList,
      });
      const fields: any[] = Array.isArray(d.templateSchema)
        ? d.templateSchema
        : [];
      setTemplateFields(fields);
      // 写入动态字段初始值（来源于 attributes）
      if (fields.length > 0 && d.attributes) {
        const dynVals: Record<string, any> = {};
        for (const f of fields) {
          const n = (f?.name || "").trim();
          if (
            n &&
            d.attributes &&
            Object.hasOwn(d.attributes, n)
          ) {
            dynVals[n] = d.attributes[n];
          }
        }
        if (Object.keys(dynVals).length > 0)
          formRef.current?.setFieldsValue(dynVals);
      }
    }
  };

  const handleFinish = async (values: any) => {
    // 基于模板字段收集动态属性
    let attrs: Record<string, any> = {};
    if (Array.isArray(templateFields) && templateFields.length > 0) {
      for (const f of templateFields) {
        const n = (f?.name || "").trim();
        if (!n) continue;
        if (Object.hasOwn(values, n)) {
          attrs[n] = values[n];
        }
      }
    } else if (values.attributes) {
      attrs = values.attributes as Record<string, any>;
    }

    const basePayload: any = {
      title: values.title,
      slug: values.slug,
      summary: values.summary,
      content: values.content,
      coverImage: values.coverImage,
      status: values.status,
      isPinned: values.isPinned,
      publishTime: values.publishTime,
      tags: values.tags,
      templateId: values.templateId ?? initialValues?.templateId,
      categoryIds: values.categoryIds,
      attributes: attrs,
    };
    if (!initialValues?.id) {
      const res = await createArticle(basePayload as API.createArticleReq);
      if (res.success) {
        if (onFinish) await onFinish();
        return true;
      }
      return false;
    }
    const res = await updateArticle(
      { id: Number(initialValues.id) },
      basePayload as API.updateArticleReq
    );
    if (res.success) {
      if (onFinish) await onFinish();
      return true;
    }
    return false;
  };

  return (
    <DrawerForm
      title={title}
      trigger={trigger}
      autoFocusFirstInput
      width={860}
      grid
      formRef={formRef}
      initialValues={initialValues}
      drawerProps={{ destroyOnClose: true, maskClosable: false }}
      onOpenChange={(open: boolean) => {
        if (open) {
          if (initialValues?.id) fetchDetail(initialValues.id);
        }
      }}
      onFinish={handleFinish}
    >
      <ProFormText
        name="title"
        label="标题"
        placeholder="请输入标题"
        colProps={{ span: 12 }}
      />
      <ProFormText
        name="slug"
        label="URL标识"
        placeholder="请输入URL标识"
        colProps={{ span: 12 }}
      />
      <ProFormSwitch name="isPinned" label="置顶" colProps={{ span: 12 }} />

      <ProFormRadio.Group
        name="status"
        label="状态"
        options={[
          { label: "草稿", value: "0" },
          { label: "已发布", value: "1" },
        ]}
        colProps={{ span: 12 }}
      />

      <ProFormDateTimePicker
        name="publishTime"
        label="发布时间"
        colProps={{ span: 12 }}
        fieldProps={{ style: { width: "100%" } }}
        transform={(v: any) => {
          if (!v) return { publishTime: undefined };
          const d = dayjs(v);
          return { publishTime: d.isValid() ? d.toISOString() : undefined };
        }}
      />

      <ProFormSelect
        name="categoryIds"
        label="所属分类"
        placeholder="请选择分类"
        showSearch
        debounceTime={200}
        request={async (params: { keyWords: string }) => {
          const res = await getCategoryList({
            page: 1,
            pageSize: 100,
            status: "1",
            keyword: params.keyWords,
            sortBy: "sort_order",
            sortOrder: "asc",
          });
          return (res.data || []).map((c: API.portalCategory) => ({
            label: c.name,
            value: c.id,
          }));
        }}
        fieldProps={{ mode: "multiple", maxTagCount: "responsive" }}
        colProps={{ span: 24 }}
      />

      <ProFormSelect
        name="tags"
        label="标签"
        placeholder="请输入并按回车添加"
        colProps={{ span: 24 }}
        fieldProps={{ mode: "tags", tokenSeparators: [","] }}
      />

      <ProForm.Item name="coverImage" label="封面图" colProps={{ span: 24 }}>
        <AttachmentImageSelect />
      </ProForm.Item>

      <ProFormTextArea
        name="summary"
        label="摘要"
        placeholder="请输入摘要"
        colProps={{ span: 24 }}
      />

      <Col span={24}>
        <ProForm.Item name="content" label="正文">
          <FormEditor imageUploadAdapter={imageUploadAdapter} />
        </ProForm.Item>
      </Col>

      <AttachmentLibraryModal
        open={imageLibraryOpen}
        onCancel={() => {
          setImageLibraryOpen(false);
          pickRejectRef.current?.(new Error("cancelled"));
          pickRejectRef.current = undefined;
          pickResolveRef.current = undefined;
        }}
        kind="image"
        multiple={imageLibraryMultiple}
        valueType="url"
        initialSelectedValues={[]}
        onSelect={(items) => {
          const cfg = initialState?.cloudStorageConfig;
          const picked: ImageInsertItem[] = items
            .map((a) => {
              const src = resolveAttachmentPublicUrl(a, cfg);
              if (!src) return null;
              const title = String(a.name || "").trim() || undefined;
              return { src, title, alt: title };
            })
            .filter(Boolean) as ImageInsertItem[];

          setImageLibraryOpen(false);
          pickResolveRef.current?.(picked);
          pickRejectRef.current = undefined;
          pickResolveRef.current = undefined;
        }}
      />

      {/* 扩展区：动态模板字段渲染，位于表单底部 */}
      {Array.isArray(templateFields) && templateFields.length > 0 && (
        <>
          <Col span={24}>
            <Divider>扩展字段</Divider>
          </Col>
          <TemplateDynamicFields fields={templateFields} />
        </>
      )}
    </DrawerForm>
  );
};

export default ArticleForm;
