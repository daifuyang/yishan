import React, { useEffect, useRef, useState } from "react";
import {
  PageContainer,
  ProForm,
  ProFormText,
  ProFormSelect,
  ProFormDigit,
  ProFormRadio,
  ProFormDependency,
} from "@ant-design/pro-components";
import { Card, App } from "antd";
import { useModel } from "@umijs/max";
import { batchGetSystemOptionByQuery, batchSetSystemOption } from "@/services/yishan-admin/system";

type QiniuRegion = "z0" | "z1" | "z2" | "na0" | "as0";
type QiniuConfig = {
  provider?: "qiniu";
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

type AliyunOssConfig = {
  provider?: "aliyunOss";
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  endpoint?: string;
  domain?: string;
  useHttps?: boolean;
};

type StorageProvider = "disabled" | "qiniu" | "aliyunOss";

type FormValues = {
  provider: StorageProvider;
  qiniu: QiniuConfig;
  aliyunOss: AliyunOssConfig;
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

const providerOptions: Array<{ label: string; value: StorageProvider }> = [
  { label: "不启用", value: "disabled" },
  { label: "七牛云", value: "qiniu" },
  { label: "阿里云 OSS", value: "aliyunOss" },
];

const defaultQiniuValues: QiniuConfig = {
  provider: "qiniu",
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

const defaultAliyunOssValues: AliyunOssConfig = {
  provider: "aliyunOss",
  accessKeyId: "",
  accessKeySecret: "",
  bucket: "",
  region: "",
  endpoint: "",
  domain: "",
  useHttps: true,
};

const SYSTEM_OPTION_KEYS = {
  SYSTEM_STORAGE: "systemStorage",
  QINIU: "qiniuConfig",
  ALIYUN_OSS: "aliyunOssConfig",
} as const;

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

const CloudConfigPage: React.FC = () => {
  const formRef = useRef<any>(undefined);
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<FormValues>({
    provider: "disabled",
    qiniu: defaultQiniuValues,
    aliyunOss: defaultAliyunOssValues,
  });
  const { initialState } = useModel("@@initialState");
  const dictDataMap = initialState?.dictDataMap || {};
  const regionDict: Array<{ label: string; value: QiniuRegion }> =
    Array.isArray(dictDataMap.qiniu_region) && dictDataMap.qiniu_region.length > 0
      ? dictDataMap.qiniu_region
      : regionOptions;

  const { message } = App.useApp();

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const res = await batchGetSystemOptionByQuery({
          key: [SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, SYSTEM_OPTION_KEYS.QINIU, SYSTEM_OPTION_KEYS.ALIYUN_OSS],
        });
        const results = res.data?.results || [];
        const map = results.reduce<Record<string, string | null>>((acc, item) => {
          if (item?.key) acc[String(item.key)] = item.value ?? null;
          return acc;
        }, {});

        const mode = String(map[SYSTEM_OPTION_KEYS.SYSTEM_STORAGE] ?? "0");
        const provider: StorageProvider = mode === "1" ? "qiniu" : mode === "2" ? "aliyunOss" : "disabled";
        const nextQiniu = parseJson<QiniuConfig>(map[SYSTEM_OPTION_KEYS.QINIU], defaultQiniuValues);
        const nextAliyunOss = parseJson<AliyunOssConfig>(
          map[SYSTEM_OPTION_KEYS.ALIYUN_OSS],
          defaultAliyunOssValues
        );

        const nextFormValues: FormValues = {
          provider,
          qiniu: nextQiniu,
          aliyunOss: nextAliyunOss,
        };
        setInitialValues(nextFormValues);
        formRef.current?.setFieldsValue(nextFormValues);
      } catch {
        const nextFormValues: FormValues = {
          provider: "disabled",
          qiniu: defaultQiniuValues,
          aliyunOss: defaultAliyunOssValues,
        };
        setInitialValues(nextFormValues);
        formRef.current?.setFieldsValue(nextFormValues);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  return (
    <PageContainer title="云存储">
      <Card loading={loading}>
        <ProForm<FormValues>
          grid
          formRef={formRef}
          initialValues={initialValues}
          onFinish={async (values: FormValues) => {
            const batchItems: Array<{ key: string; value: string }> = [];

            if (values.provider === "disabled") {
              batchItems.push(
                { key: SYSTEM_OPTION_KEYS.QINIU, value: "" },
                { key: SYSTEM_OPTION_KEYS.ALIYUN_OSS, value: "" },
                { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: "0" }
              );
            } else if (values.provider === "qiniu") {
              const payload: QiniuConfig = {
                provider: "qiniu",
                accessKey: values.qiniu.accessKey,
                secretKey: values.qiniu.secretKey,
                bucket: values.qiniu.bucket,
                region: values.qiniu.region,
                domain: values.qiniu.domain,
                uploadHost: values.qiniu.uploadHost,
                useHttps: !!values.qiniu.useHttps,
                useCdnDomains: !!values.qiniu.useCdnDomains,
                tokenExpires: Number(values.qiniu.tokenExpires ?? 3600),
                callbackUrl: values.qiniu.callbackUrl,
              };
              batchItems.push(
                { key: SYSTEM_OPTION_KEYS.QINIU, value: JSON.stringify(payload) },
                { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: "1" }
              );
            } else if (values.provider === "aliyunOss") {
              const payload: AliyunOssConfig = {
                provider: "aliyunOss",
                accessKeyId: values.aliyunOss.accessKeyId,
                accessKeySecret: values.aliyunOss.accessKeySecret,
                bucket: values.aliyunOss.bucket,
                region: values.aliyunOss.region,
                endpoint: values.aliyunOss.endpoint,
                domain: values.aliyunOss.domain,
                useHttps: !!values.aliyunOss.useHttps,
              };
              batchItems.push(
                { key: SYSTEM_OPTION_KEYS.ALIYUN_OSS, value: JSON.stringify(payload) },
                { key: SYSTEM_OPTION_KEYS.SYSTEM_STORAGE, value: "2" }
              );
            }

            if (batchItems.length > 0) {
              const res = await batchSetSystemOption(batchItems as any);
              if (res.success) {
                message.success("保存成功");
              } else {
                message.error(res.message || "保存失败");
              }
            }
            return true;
          }}
        >
          <ProFormSelect
            name="provider"
            label="服务商"
            placeholder="请选择服务商"
            options={providerOptions}
            rules={[{ required: true, message: "请选择服务商" }]}
            colProps={{ span: 12 }}
          />

          <ProFormDependency name={["provider"]}>
            {({ provider }: { provider?: StorageProvider }) => {
              if (provider === "qiniu") {
                return (
                  <>
                    <ProFormText
                      name={["qiniu", "accessKey"]}
                      label="AccessKey"
                      placeholder="请输入 AccessKey"
                      rules={[{ required: true, message: "请输入 AccessKey" }]}
                      colProps={{ span: 12 }}
                    />

                    <ProFormText.Password
                      name={["qiniu", "secretKey"]}
                      label="SecretKey"
                      placeholder="请输入 SecretKey"
                      rules={[{ required: true, message: "请输入 SecretKey" }]}
                      colProps={{ span: 12 }}
                      fieldProps={{ autoComplete: "off" }}
                    />

                    <ProFormText
                      name={["qiniu", "bucket"]}
                      label="Bucket"
                      placeholder="请输入存储空间名称"
                      rules={[{ required: true, message: "请输入存储空间名称" }]}
                      colProps={{ span: 12 }}
                    />

                    <ProFormSelect
                      name={["qiniu", "region"]}
                      label="区域"
                      placeholder="请选择存储区域"
                      options={regionDict}
                      rules={[{ required: true, message: "请选择存储区域" }]}
                      colProps={{ span: 12 }}
                    />

                    <ProFormText
                      name={["qiniu", "domain"]}
                      label="外链域名"
                      placeholder="例如 https://static.example.com"
                      colProps={{ span: 12 }}
                    />

                    <ProFormText
                      name={["qiniu", "uploadHost"]}
                      label="上传域名"
                      placeholder="可选，按区域选择默认或自定义"
                      colProps={{ span: 12 }}
                    />

                    <ProFormRadio.Group
                      name={["qiniu", "useHttps"]}
                      label="使用 HTTPS"
                      options={boolOptions}
                      colProps={{ span: 12 }}
                    />

                    <ProFormRadio.Group
                      name={["qiniu", "useCdnDomains"]}
                      label="使用 CDN 域名"
                      options={boolOptions}
                      colProps={{ span: 12 }}
                    />

                    <ProFormDigit
                      name={["qiniu", "tokenExpires"]}
                      label="上传凭证过期(秒)"
                      fieldProps={{ min: 60 }}
                      colProps={{ span: 12 }}
                    />

                    <ProFormText
                      name={["qiniu", "callbackUrl"]}
                      label="回调地址"
                      placeholder="可选，用于持久化处理通知"
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              if (provider === "aliyunOss") {
                return (
                  <>
                    <ProFormText
                      name={["aliyunOss", "accessKeyId"]}
                      label="AccessKeyId"
                      placeholder="请输入 AccessKeyId"
                      rules={[{ required: true, message: "请输入 AccessKeyId" }]}
                      colProps={{ span: 12 }}
                    />

                    <ProFormText.Password
                      name={["aliyunOss", "accessKeySecret"]}
                      label="AccessKeySecret"
                      placeholder="请输入 AccessKeySecret"
                      rules={[{ required: true, message: "请输入 AccessKeySecret" }]}
                      colProps={{ span: 12 }}
                      fieldProps={{ autoComplete: "off" }}
                    />

                    <ProFormText
                      name={["aliyunOss", "bucket"]}
                      label="Bucket"
                      placeholder="请输入存储空间名称"
                      rules={[{ required: true, message: "请输入存储空间名称" }]}
                      colProps={{ span: 12 }}
                    />

                    <ProFormText
                      name={["aliyunOss", "region"]}
                      label="Region"
                      placeholder="例如 cn-hangzhou"
                      rules={[{ required: true, message: "请输入 Region" }]}
                      colProps={{ span: 12 }}
                    />

                    <ProFormText
                      name={["aliyunOss", "endpoint"]}
                      label="Endpoint"
                      placeholder="例如 https://oss-cn-hangzhou.aliyuncs.com"
                      colProps={{ span: 12 }}
                    />

                    <ProFormText
                      name={["aliyunOss", "domain"]}
                      label="外链域名"
                      placeholder="例如 https://static.example.com"
                      colProps={{ span: 12 }}
                    />

                    <ProFormRadio.Group
                      name={["aliyunOss", "useHttps"]}
                      label="使用 HTTPS"
                      options={boolOptions}
                      colProps={{ span: 12 }}
                    />
                  </>
                );
              }

              return null;
            }}
          </ProFormDependency>
        </ProForm>
      </Card>
    </PageContainer>
  );
};

export default CloudConfigPage;
