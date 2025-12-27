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
import { DownloadOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Card, Modal, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import { useModel } from "@umijs/max";
import {
  exportStorageConfig,
  getStorageConfig,
  importStorageConfig,
  upsertStorageConfig,
} from "@/services/yishan-admin/storage";

type FormValues = {
  provider: API.storageProvider;
  qiniu: API.qiniuConfigSchema;
  aliyunOss: API.aliyunOssConfigSchema;
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

const providerOptions: Array<{ label: string; value: API.storageProvider }> = [
  { label: "不启用", value: "disabled" },
  { label: "七牛云", value: "qiniu" },
  { label: "阿里云 OSS", value: "aliyunOss" },
];

const defaultQiniuValues: API.qiniuConfigSchema = {
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

const defaultAliyunOssValues: API.aliyunOssConfigSchema = {
  provider: "aliyunOss",
  accessKeyId: "",
  accessKeySecret: "",
  bucket: "",
  region: "",
  endpoint: "",
  domain: "",
  useHttps: true,
};

const CloudConfigPage: React.FC = () => {
  const formRef = useRef<any>(undefined);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPayload, setImportPayload] = useState<API.storageConfigExportPayload | null>(null);
  const [initialValues, setInitialValues] = useState<FormValues>({
    provider: "disabled",
    qiniu: defaultQiniuValues,
    aliyunOss: defaultAliyunOssValues,
  });
  const { initialState } = useModel("@@initialState");
  const dictDataMap = initialState?.dictDataMap || {};
  const regionDict: Array<{ label: string; value: API.qiniuRegion }> =
    Array.isArray(dictDataMap.qiniu_region) && dictDataMap.qiniu_region.length > 0
      ? dictDataMap.qiniu_region
      : regionOptions as any;

  const { message } = App.useApp();

  const readFileText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.readAsText(file);
    });

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await getStorageConfig();
      const cfg = res?.data;
      if (!res?.success || !cfg) throw new Error("获取失败");

      const provider: API.storageProvider = cfg.provider || "disabled";
      const nextQiniu = { ...defaultQiniuValues, ...(cfg.qiniu || {}) };
      const nextAliyunOss = { ...defaultAliyunOssValues, ...(cfg.aliyunOss || {}) };

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

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await exportStorageConfig();
      if (!res?.success) {
        message.error(res?.message || "导出失败");
        return;
      }
      const payload = res.data || {};
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeTime = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `cloud-storage-config-${safeTime}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch {
      message.error("导出失败");
    } finally {
      setExporting(false);
    }
  };

  const uploadProps: UploadProps = {
    accept: ".json,application/json",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        const text = await readFileText(file as File);
        const data = JSON.parse(text || "{}") as API.storageConfigExportPayload;
        if (!data?.provider || !["disabled", "qiniu", "aliyunOss"].includes(data.provider)) {
          message.error("配置文件不合法：provider 缺失或不正确");
          return false;
        }
        setImportPayload(data);
        setImportModalOpen(true);
      } catch {
        message.error("配置文件解析失败，请确认是合法 JSON 文件");
        return false;
      }
      return false;
    },
  };

  const handleImportConfirm = async () => {
    if (!importPayload) return;
    try {
      setImporting(true);
      const res = await importStorageConfig(importPayload);
      if (res?.success) {
        message.success("导入成功");
        setImportModalOpen(false);
        setImportPayload(null);
        await fetchConfig();
      } else {
        message.error(res?.message || "导入失败");
      }
    } catch {
      message.error("导入失败");
    } finally {
      setImporting(false);
    }
  };

  return (
    <PageContainer
      title="云存储"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchConfig} disabled={loading}>
            刷新
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
            导出配置
          </Button>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>导入配置</Button>
          </Upload>
        </Space>
      }
    >
      <Card loading={loading}>
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <ProForm<FormValues>
            grid
            formRef={formRef}
            initialValues={initialValues}
            onFinish={async (values: FormValues) => {
              const body: API.upsertStorageConfigReq = { provider: values.provider as API.storageProvider };
              if (values.provider === "qiniu") {
                body.qiniu = {
                  ...defaultQiniuValues,
                  ...values.qiniu,
                  provider: "qiniu",
                  tokenExpires: Number(values.qiniu.tokenExpires ?? 3600),
                  useHttps: !!values.qiniu.useHttps,
                  useCdnDomains: !!values.qiniu.useCdnDomains,
                };
              }
              if (values.provider === "aliyunOss") {
                body.aliyunOss = {
                  ...defaultAliyunOssValues,
                  ...values.aliyunOss,
                  provider: "aliyunOss",
                  useHttps: !!values.aliyunOss.useHttps,
                };
              }

              const res = await upsertStorageConfig(body);
              if (res?.success) {
                message.success("保存成功");
                await fetchConfig();
              } else {
                message.error(res?.message || "保存失败");
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
              {({ provider }: { provider?: API.storageProvider }) => {
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
        </Space>
      </Card>
      <Modal
        title="导入云存储配置"
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setImportPayload(null);
        }}
        onOk={handleImportConfirm}
        okText="确认导入"
        cancelText="取消"
        confirmLoading={importing}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Text type="secondary">
            导入后将立即写入系统配置，并覆盖当前云存储设置。
          </Typography.Text>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <Typography.Text strong>服务商：</Typography.Text>
            <Typography.Text>{importPayload?.provider || "-"}</Typography.Text>
          </Typography.Paragraph>
          {importPayload?.provider === "qiniu" ? (
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              <Typography.Text strong>Bucket：</Typography.Text>
              <Typography.Text>{(importPayload.qiniu as any)?.bucket || "-"}</Typography.Text>
            </Typography.Paragraph>
          ) : null}
          {importPayload?.provider === "aliyunOss" ? (
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              <Typography.Text strong>Bucket：</Typography.Text>
              <Typography.Text>{(importPayload.aliyunOss as any)?.bucket || "-"}</Typography.Text>
            </Typography.Paragraph>
          ) : null}
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default CloudConfigPage;
