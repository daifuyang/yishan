import React, { useEffect, useState } from "react";
import type { UploadFile, UploadProps } from "antd";
import { Upload, App, Image } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { getQiniuUploadToken, getSystemOption } from "@/services/yishan-admin/system";

interface QiniuUploadProps {
  value?: string;
  onChange?: (value?: string) => void;
  dir?: string;
}

const QiniuUpload: React.FC<QiniuUploadProps> = ({ value, onChange, dir = "uploads" }) => {
  const { message } = App.useApp();
  const [config, setConfig] = useState<{ domain?: string; uploadHost?: string } | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoadingConfig(true);
        const res = await getSystemOption({ key: "qiniuConfig" } as any);
        const text = (res as any)?.data;
        if (typeof text === "string" && text.trim().length > 0) {
          try {
            const obj = JSON.parse(text);
            setConfig({ domain: obj.domain, uploadHost: obj.uploadHost });
          } catch {
            setConfig({ domain: undefined, uploadHost: undefined });
          }
        } else {
          setConfig({ domain: undefined, uploadHost: undefined });
        }
      } catch {
        setConfig({ domain: undefined, uploadHost: undefined });
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (!value) {
      setFileList([]);
      return;
    }
    const domain = config?.domain || "";
    const isAbsolute = /^https?:\/\//i.test(value);
    const url = isAbsolute
      ? value
      : domain
      ? `${domain.replace(/\/$/, "")}/${value}`
      : undefined;
    const file: UploadFile = {
      uid: "qiniu-current",
      name: value.split("/").pop() || "file",
      status: "done",
      url,
    };
    setFileList([file]);
  }, [value, config?.domain]);

  const handleChange: UploadProps["onChange"] = ({ fileList: newList }) => {
    setFileList(newList);
    const f = newList[0];
    const res = (f?.response || {}) as any;
    const url = res.url || f?.url;
    const key = res.key;
    const finalValue = url || key;
    if (finalValue) {
      onChange?.(finalValue);
    }
  };

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handlePreview = async (file: UploadFile) => {
    if (!file.url && !file.preview && file.originFileObj) {
      file.preview = await getBase64(file.originFileObj as File);
    }
    const src = file.url || (file.preview as string) || "";
    if (!src) return;
    setPreviewImage(src);
    setPreviewOpen(true);
  };

  const customRequest: UploadProps["customRequest"] = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      const f: File = file as File;
      const ext = (f.name.split(".").pop() || "").toLowerCase();
      const key = `${dir.replace(/\/$/, "")}/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}${ext ? "." + ext : ""}`;

      const tokenRes = await getQiniuUploadToken({ scopeKey: key } as any);
      const token = (tokenRes as any)?.data?.token;
      if (!token) {
        throw new Error("获取上传凭证失败");
      }

      const uploadUrl =
        (tokenRes as any)?.data?.uploadUrl || config?.uploadHost || "https://upload.qiniup.com";

      const formData = new FormData();
      formData.append("file", f);
      formData.append("token", token);
      formData.append("key", key);

      const resp = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) throw new Error(`upload failed: ${resp.status}`);
      const data = await resp.json().catch(() => ({}));

      const domain = config?.domain || "";
      const url = domain
        ? `${domain.replace(/\/$/, "")}/${key}`
        : undefined;

      const response = { key, url, response: data };
      onSuccess && onSuccess(response, file as any);
      const uploadFile: UploadFile = {
        uid: "qiniu-current",
        name: f.name,
        status: "done",
        url,
        response,
      };
      setFileList([uploadFile]);
      onChange?.(url || key);
    } catch (e: any) {
      if (e instanceof Error) {
        message.error(e.message);
      }
      onError && onError(e);
    }
  };

  const uploadProps: UploadProps = {
    name: "file",
    listType: "picture-card",
    accept: "image/*",
    fileList,
    customRequest,
    onChange: handleChange,
    multiple: false,
    showUploadList: true,
    onPreview: handlePreview,
  };

  return (
    <>
      <Upload {...uploadProps} disabled={loadingConfig}>
        {fileList && fileList.length > 0 ? null : (
          <div style={{ border: 0, background: "none" }}>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>上传</div>
          </div>
        )}
      </Upload>
      {previewImage && (
        <Image
          styles={{ root: { display: "none" } }}
          preview={{
            src: previewImage,
            open: previewOpen,
            onOpenChange: (open) => {
              setPreviewOpen(open)
              if (!open) setPreviewImage("");
            }
          }}
        />
      )}
    </>
  );
};

export default QiniuUpload;
