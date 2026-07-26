import { DownloadOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Card, Modal, Space, Typography, Upload } from "antd";
import type { UploadProps } from "antd";
import React from "react";
import {
  PageContainer,
  ProForm,
  ProFormText,
  ProFormSelect,
  ProFormDigit,
  ProFormRadio,
  ProFormDependency,
} from "@ant-design/pro-components";
import { upsertStorageConfig } from "@/services/generated/storage";
import { regionOptions, boolOptions, providerOptions, defaultQiniuValues, defaultAliyunOssValues } from "./constants";
import type { FormValues } from "./types";
import { useStorageConfig } from "./hooks/useStorageConfig";

const CloudConfigPage: React.FC = () => {
  const { message } = App.useApp();
  const {
    formRef, loading, exporting, importModalOpen, setImportModalOpen,
    importing, importPayload, setImportPayload, initialValues,
    fetchConfig, handleExport, handleImportConfirm, readFileText,
  } = useStorageConfig(message);

  const uploadProps: UploadProps = {
    multiple: false,
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        const text = await readFileText(file);
        const payload = JSON.parse(text);
        setImportPayload(payload as API.storageConfigExportPayload);
        setImportModalOpen(true);
      } catch (e: any) {
        message.error("文件解析失败: " + (e.message || ""));
      }
      return false;
    },
  };

  return (
    <PageContainer
      header={{
        title: "存储配置",
        subTitle: "配置云存储服务商参数，上传的素材文件将存储到对应服务",
        extra: (
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchConfig} loading={loading}>
              刷新
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
              导出
            </Button>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>导入</Button>
            </Upload>
          </Space>
        ),
      }}
    >
      <Card>
        <ProForm<FormValues>
          formRef={formRef as any}
          loading={loading}
          initialValues={initialValues}
          onFinish={async (values) => {
            const body = {
              provider: values.provider,
              qiniu: values.provider === "qiniu" ? values.qiniu : undefined,
              aliyunOss: values.provider === "aliyunOss" ? values.aliyunOss : undefined,
            };
            try {
              const res = await upsertStorageConfig(body);
              if (res.success) {
                message.success(res.message || "保存成功");
              } else {
                message.error(res.message || "保存失败");
              }
            } catch (e: any) {
              message.error(e?.message || "保存失败");
            }
          }}
          submitter={{ searchConfig: { submitText: "保存" } }}
        >
          <ProFormSelect name="provider" label="存储服务商" options={providerOptions} rules={[{ required: true }]} />

          <ProFormDependency name={["provider"]}>
            {({ provider }) => {
              if (provider === "qiniu") {
                return (
                  <>
                    <ProFormText name={["qiniu", "accessKey"]} label="AccessKey" rules={[{ required: true }]} />
                    <ProFormText name={["qiniu", "secretKey"]} label="SecretKey" rules={[{ required: true }]} />
                    <ProFormText name={["qiniu", "bucket"]} label="Bucket" rules={[{ required: true }]} />
                    <ProFormSelect name={["qiniu", "region"]} label="区域" options={regionOptions} rules={[{ required: true }]} />
                    <ProFormText name={["qiniu", "domain"]} label="CDN 域名" rules={[{ required: true }]} placeholder="https://cdn.example.com" />
                    <ProFormText name={["qiniu", "uploadHost"]} label="上传地址" placeholder="up.qiniu.com（可选）" />
                    <ProFormRadio name={["qiniu", "useHttps"]} label="HTTPS" options={boolOptions} />
                    <ProFormRadio name={["qiniu", "useCdnDomains"]} label="CDN 加速" options={boolOptions} />
                    <ProFormDigit name={["qiniu", "tokenExpires"]} label="Token 过期时间（秒）" min={60} max={86400} />
                    <ProFormText name={["qiniu", "callbackUrl"]} label="回调地址" placeholder="可选" />
                  </>
                );
              }
              if (provider === "aliyunOss") {
                return (
                  <>
                    <ProFormText name={["aliyunOss", "accessKeyId"]} label="AccessKeyId" rules={[{ required: true }]} />
                    <ProFormText name={["aliyunOss", "accessKeySecret"]} label="AccessKeySecret" rules={[{ required: true }]} />
                    <ProFormText name={["aliyunOss", "bucket"]} label="Bucket" rules={[{ required: true }]} />
                    <ProFormSelect name={["aliyunOss", "region"]} label="区域" rules={[{ required: true }]} />
                    <ProFormText name={["aliyunOss", "endpoint"]} label="Endpoint" rules={[{ required: true }]} />
                    <ProFormText name={["aliyunOss", "domain"]} label="CDN 域名" />
                    <ProFormRadio name={["aliyunOss", "useHttps"]} label="HTTPS" options={boolOptions} />
                  </>
                );
              }
              return (
                <Typography.Text type="secondary">
                  选择服务商后显示对应配置项
                </Typography.Text>
              );
            }}
          </ProFormDependency>
        </ProForm>
      </Card>

      <Modal
        title="导入配置"
        open={importModalOpen}
        okText="确认导入"
        onCancel={() => { setImportModalOpen(false); setImportPayload(null); }}
        onOk={handleImportConfirm}
        confirmLoading={importing}
      >
        <Typography.Paragraph>
          确认导入以下配置？此操作将覆盖当前存储配置。
        </Typography.Paragraph>
        {importPayload && (
          <pre style={{ maxHeight: 300, overflow: "auto", background: "#f5f5f5", padding: 12, borderRadius: 4 }}>
            {JSON.stringify(importPayload, null, 2)}
          </pre>
        )}
      </Modal>
    </PageContainer>
  );
};

export default CloudConfigPage;
