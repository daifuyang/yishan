import React, { useEffect, useRef, useState } from "react";
import { PageContainer, ProForm, ProFormText, ProFormTextArea } from "@ant-design/pro-components";
import { App, Card } from "antd";
import { batchGetSystemOptionByQuery, batchSetSystemOption } from "@/services/yishan-admin/system";

type BasicConfig = {
  siteName: string;
  siteDomain: string;
  siteTitle: string;
  siteLogo: string;
  siteFavicon: string;
  seoKeywords: string;
  seoDescription: string;
  icp: string;
  publicSecurityIcp: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  footerHtml: string;
};

const BASIC_CONFIG_KEY = "basicConfig";

const defaultBasicConfig: BasicConfig = {
  siteName: "",
  siteDomain: "",
  siteTitle: "",
  siteLogo: "",
  siteFavicon: "",
  seoKeywords: "",
  seoDescription: "",
  icp: "",
  publicSecurityIcp: "",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  footerHtml: "",
};

const parseJson = <T,>(text: string | null | undefined, fallback: T): T => {
  if (typeof text !== "string") return fallback;
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(trimmed) || {}) };
  } catch {
    return fallback;
  }
};

const SiteConfigPage: React.FC = () => {
  const formRef = useRef<any>(undefined);
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<BasicConfig>(defaultBasicConfig);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const res = await batchGetSystemOptionByQuery({ "key[]": [BASIC_CONFIG_KEY] });
        const value = res.data?.results?.find((i) => i.key === BASIC_CONFIG_KEY)?.value ?? null;
        const nextValues = parseJson<BasicConfig>(value, defaultBasicConfig);
        setInitialValues(nextValues);
        formRef.current?.setFieldsValue(nextValues);
      } catch {
        setInitialValues(defaultBasicConfig);
        formRef.current?.setFieldsValue(defaultBasicConfig);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  return (
    <PageContainer title="站点配置">
      <Card loading={loading}>
        <ProForm<BasicConfig>
          grid
          formRef={formRef}
          initialValues={initialValues}
          onFinish={async (values) => {
            const payload: BasicConfig = {
              ...defaultBasicConfig,
              ...values,
            };
            const res = await batchSetSystemOption([{ key: BASIC_CONFIG_KEY, value: JSON.stringify(payload) }] as any);
            if (res.success) message.success("保存成功");
            else message.error(res.message || "保存失败");
            return true;
          }}
        >
          <ProFormText
            name="siteName"
            label="站点名称"
            placeholder="请输入站点名称"
            rules={[{ required: true, message: "请输入站点名称" }]}
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="siteDomain"
            label="站点域名"
            placeholder="如：https://example.com"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="siteTitle"
            label="站点标题"
            placeholder="用于浏览器标题与 SEO Title"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="siteLogo"
            label="LOGO 地址"
            placeholder="如：https://example.com/logo.png 或 /assets/logo.png"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="siteFavicon"
            label="Favicon 地址"
            placeholder="如：https://example.com/favicon.ico 或 /favicon.ico"
            colProps={{ span: 12 }}
          />
          <ProFormTextArea
            name="seoKeywords"
            label="SEO 关键词"
            placeholder="多个关键词用英文逗号分隔"
            colProps={{ span: 24 }}
          />
          <ProFormTextArea
            name="seoDescription"
            label="SEO 描述"
            placeholder="用于搜索引擎描述"
            colProps={{ span: 24 }}
          />
          <ProFormText
            name="icp"
            label="ICP备案号"
            placeholder="如：沪ICP备xxxxxx号"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="publicSecurityIcp"
            label="公安备案号"
            placeholder="如：沪公网安备 xxxxxxxxxxxxx 号"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="contactEmail"
            label="联系邮箱"
            placeholder="如：contact@example.com"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="contactPhone"
            label="联系电话"
            placeholder="如：400-xxx-xxxx"
            colProps={{ span: 12 }}
          />
          <ProFormText
            name="contactAddress"
            label="联系地址"
            placeholder="用于站点页脚或联系我们"
            colProps={{ span: 24 }}
          />
          <ProFormTextArea
            name="footerHtml"
            label="页脚内容"
            placeholder="支持 HTML（可用于版权信息、备案链接等）"
            fieldProps={{ autoSize: { minRows: 4, maxRows: 10 } }}
            colProps={{ span: 24 }}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default SiteConfigPage;
