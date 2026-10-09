import type { FormValues } from './types';

export const regionOptions = [
  { label: "华东 z0", value: "z0" },
  { label: "华北 z1", value: "z1" },
  { label: "华南 z2", value: "z2" },
  { label: "北美 na0", value: "na0" },
  { label: "东南亚 as0", value: "as0" },
];

export const boolOptions = [
  { label: "是", value: true },
  { label: "否", value: false },
];

export const providerOptions: Array<{ label: string; value: API.storageProvider }> = [
  { label: "不启用", value: "disabled" },
  { label: "七牛云", value: "qiniu" },
  { label: "阿里云 OSS", value: "aliyunOss" },
];

export const defaultQiniuValues: API.qiniuConfigSchema = {
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

export const defaultAliyunOssValues: API.aliyunOssConfigSchema = {
  provider: "aliyunOss",
  accessKeyId: "",
  accessKeySecret: "",
  bucket: "",
  region: "",
  endpoint: "",
  domain: "",
  useHttps: true,
};
