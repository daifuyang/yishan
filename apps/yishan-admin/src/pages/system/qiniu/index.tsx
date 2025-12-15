import React, { useEffect, useRef, useState } from "react";
import { PageContainer, ProForm, ProFormText, ProFormSelect, ProFormDigit, ProFormRadio, type ProFormInstance } from "@ant-design/pro-components";
import { Card, App } from "antd";
import { useModel } from "@umijs/max";
import { getSystemOption, setSystemOption } from "@/services/yishan-admin/system";

type QiniuRegion = "z0" | "z1" | "z2" | "na0" | "as0";
type QiniuConfig = {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: QiniuRegion;
  domain?: string;
  useHttps?: boolean;
  useCdnDomains?: boolean;
  tokenExpires?: number;
  callbackUrl?: string;
  uploadHost?: string;
};

const regionOptions = [
  { label: "华东 z0", value: "z0" },
  { label: "华北 z1", value: "z1" },
  { label: "华南 z2", value: "z2" },
  { label: "北美 na0", value: "na0" },
  { label: "东南亚 as0", value: "as0" },
];

const boolOptions = [
  { label: "是", value: true },
  { label: "否", value: false },
];

const defaultValues: QiniuConfig = {
  accessKey: "",
  secretKey: "",
  bucket: "",
  region: "z0",
  domain: "",
  useHttps: true,
  useCdnDomains: true,
  tokenExpires: 3600,
  callbackUrl: "",
  uploadHost: "",
};

const QiniuConfigPage: React.FC = () => {
  const formRef = useRef<ProFormInstance>(null);
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<QiniuConfig>(defaultValues);
  const { initialState } = useModel('@@initialState');
  const dictDataMap = initialState?.dictDataMap || {};
  const regionDict = Array.isArray(dictDataMap.qiniu_region) && dictDataMap.qiniu_region.length > 0 ? dictDataMap.qiniu_region : regionOptions;

  const { message } = App.useApp();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const res = await getSystemOption({ key: "qiniuConfig" });
        const text = (res as any)?.data;
        let nextVals = { ...defaultValues } as QiniuConfig;
        if (typeof text === "string" && text.trim().length > 0) {
          try {
            const obj = JSON.parse(text);
            nextVals = {
              ...nextVals,
              ...(obj || {}),
            } as QiniuConfig;
          } catch {}
        }
        setInitialValues(nextVals);
        formRef.current?.setFieldsValue(nextVals);
      } catch {
        setInitialValues(defaultValues);
        formRef.current?.setFieldsValue(defaultValues);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  return (
    <PageContainer>
      <Card loading={loading}>
        <ProForm<QiniuConfig>
          grid
          formRef={formRef}
          initialValues={initialValues}
          onFinish={async (values: QiniuConfig) => {
            const payload = {
              accessKey: values.accessKey,
              secretKey: values.secretKey,
              bucket: values.bucket,
              region: values.region,
              domain: values.domain,
              uploadHost: values.uploadHost,
              useHttps: !!values.useHttps,
              useCdnDomains: !!values.useCdnDomains,
              tokenExpires: Number(values.tokenExpires ?? 3600),
              callbackUrl: values.callbackUrl,
            };
            const res = await setSystemOption({ key: "qiniuConfig" } as any, { value: JSON.stringify(payload) } as any);
            if (res.success) {
              message.success((res as any)?.message || "保存成功");
            } else {
              message.error((res as any)?.message || "保存失败");
            }
          }}
        >
          <ProFormText
            name="accessKey"
            label="AccessKey"
            placeholder="请输入 AccessKey"
            rules={[{ required: true, message: "请输入 AccessKey" }]}
            colProps={{ span: 12 }}
          />

          <ProFormText.Password
            name="secretKey"
            label="SecretKey"
            placeholder="请输入 SecretKey"
            rules={[{ required: true, message: "请输入 SecretKey" }]}
            colProps={{ span: 12 }}
            fieldProps={{ autoComplete: "off" }}
          />

          <ProFormText
            name="bucket"
            label="Bucket"
            placeholder="请输入存储空间名称"
            rules={[{ required: true, message: "请输入存储空间名称" }]}
            colProps={{ span: 12 }}
          />

          <ProFormSelect
            name="region"
            label="区域"
            placeholder="请选择存储区域"
            options={regionDict as any}
            rules={[{ required: true, message: "请选择存储区域" }]}
            colProps={{ span: 12 }}
          />

          <ProFormText
            name="domain"
            label="外链域名"
            placeholder="例如 https://static.example.com"
            colProps={{ span: 12 }}
          />

          <ProFormText
            name="uploadHost"
            label="上传域名"
            placeholder="可选，按区域选择默认或自定义"
            colProps={{ span: 12 }}
          />

          <ProFormRadio.Group
            name="useHttps"
            label="使用 HTTPS"
            options={boolOptions}
            colProps={{ span: 12 }}
          />

          <ProFormRadio.Group
            name="useCdnDomains"
            label="使用 CDN 域名"
            options={boolOptions}
            colProps={{ span: 12 }}
          />

          <ProFormDigit
            name="tokenExpires"
            label="上传凭证过期(秒)"
            fieldProps={{ min: 60 }}
            colProps={{ span: 12 }}
          />

          <ProFormText
            name="callbackUrl"
            label="回调地址"
            placeholder="可选，用于持久化处理通知"
            colProps={{ span: 12 }}
          />
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default QiniuConfigPage;
