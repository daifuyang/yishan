import React, { useRef, useState } from "react";
import { DrawerForm, ProTable, type ProFormInstance, type ProColumns } from "@ant-design/pro-components";
import { App, Button, Popconfirm } from "antd";
import { getArticleTemplateSchema, updateArticleTemplateSchema } from "@/services/yishan-admin/portalArticles";
import { getPageTemplateSchema, updatePageTemplateSchema } from "@/services/yishan-admin/portalPages";
import TemplateFieldForm from "./TemplateFieldForm";

type TemplateKind = "article" | "page";

export interface TemplateSchemaFormProps {
  title: string;
  trigger?: JSX.Element;
  templateId: number;
  type: TemplateKind;
  onFinish?: () => Promise<void>;
}

const FIELD_TYPE_TEXT: Record<string, string> = {
  input: "输入框",
  textarea: "文本域",
  radio: "单选",
  checkbox: "多选",
  select: "下拉选择",
  number: "数字",
  switch: "开关",
  date: "日期",
  datetime: "日期时间",
};

const TemplateSchemaForm: React.FC<TemplateSchemaFormProps> = ({ title, trigger, templateId, type, onFinish }) => {
  const formRef = useRef<ProFormInstance>(null);
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<any[]>([]);

  const fetchSchema = async () => {
    setLoading(true);
    try {
      const res = type === "article"
        ? await getArticleTemplateSchema({ id: templateId })
        : await getPageTemplateSchema({ id: templateId });
      const schema: any[] = Array.isArray(res?.data) ? res.data : [];
      setFields(schema);
    } catch (e) {
      message.error("加载模板结构失败");
    } finally {
      setLoading(false);
    }
  };

  const syncSchema = async (schema: any[]) => {
    const res = type === "article"
      ? await updateArticleTemplateSchema({ id: templateId }, { schema } as any)
      : await updatePageTemplateSchema({ id: templateId }, { schema } as any);
    if (res.success) {
      message.success(res.message || "模板结构已更新");
      await onFinish?.();
      return true;
    }
    return false;
  };

  return (
    <DrawerForm
      title={title}
      trigger={trigger}
      formRef={formRef}
      width={900}
      drawerProps={{ destroyOnClose: true, maskClosable: false }}
      loading={loading}
      onOpenChange={(open) => { if (open) fetchSchema(); }}
      onFinish={async () => true}
      submitter={false}
    >
      <ProTable<any>
        rowKey={(r, i) => String(i)}
        search={false}
        options={false}
        pagination={false}
        headerTitle={"结构字段列表"}
        toolBarRender={() => [
          <TemplateFieldForm
            key="add"
            title="新增字段"
            trigger={<Button type="primary">新增字段</Button>}
            onSubmit={async (field) => {
              const next = [...fields, field];
              const ok = await syncSchema(next);
              if (ok) setFields(next);
              return ok;
            }}
          />
        ]}
        dataSource={fields}
        columns={[
          { title: "显示名称", dataIndex: "label" },
          { title: "字段标识", dataIndex: "name" },
          { title: "类型", dataIndex: "type", render: (_, r) => FIELD_TYPE_TEXT[r.type] || r.type },
          { title: "必填", dataIndex: "required", render: (_, r) => (r.required ? "是" : "否") },
          { title: "选项数", dataIndex: "options", render: (_, r) => Array.isArray(r.options) ? r.options.length : 0 },
          {
            title: "操作",
            valueType: "option",
            render: (_, record, index) => [
              <TemplateFieldForm
                key="edit"
                title="编辑字段"
                trigger={<a>编辑</a>}
                initialValues={record}
                onSubmit={async (field) => {
                  const next = fields.slice();
                  next[index] = field;
                  const ok = await syncSchema(next);
                  if (ok) setFields(next);
                  return ok;
                }}
              />,
              <Popconfirm key="delete" title="确定删除该字段吗？" onConfirm={async () => {
                const next = fields.filter((_, i) => i !== index);
                const ok = await syncSchema(next);
                if (ok) setFields(next);
              }}>
                <Button className="p-0" type="link" danger>删除</Button>
              </Popconfirm>,
            ],
          },
        ] as ProColumns<any>[]}
      />
    </DrawerForm>
  );
};

export default TemplateSchemaForm;
