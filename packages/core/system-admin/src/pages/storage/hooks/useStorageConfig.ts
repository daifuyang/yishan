import { useState, useEffect, useRef } from 'react';
import { getStorageConfig, upsertStorageConfig, exportStorageConfig, importStorageConfig } from '@/services/generated/storage';
import type { FormValues } from '../types';
import { defaultQiniuValues, defaultAliyunOssValues } from '../constants';

export function useStorageConfig(message: any) {
  const formRef = useRef<any>(undefined);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPayload, setImportPayload] = useState<API.storageConfigExportPayload | null>(null);
  const [initialValues, setInitialValues] = useState<FormValues>({
    provider: 'disabled',
    qiniu: defaultQiniuValues,
    aliyunOss: defaultAliyunOssValues,
  });

  const readFileText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsText(file);
    });

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await getStorageConfig();
      const data = res.data;
      if (data) {
        setInitialValues({
          provider: data.provider || 'disabled',
          qiniu: { ...defaultQiniuValues, ...data.qiniu },
          aliyunOss: { ...defaultAliyunOssValues, ...data.aliyunOss },
        });
      }
    } catch (e: any) {
      message.error(e?.message || '加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await exportStorageConfig();
      if (res.data) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'storage-config.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      message.error(e?.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleImportConfirm = async () => {
    if (!importPayload) return;
    setImporting(true);
    try {
      const res = await importStorageConfig(importPayload);
      if (res.success) {
        message.success('导入成功');
        setImportModalOpen(false);
        setImportPayload(null);
        await fetchConfig();
      } else {
        message.error(res.message || '导入失败');
      }
    } catch (e: any) {
      message.error(e?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    formRef, loading, exporting, importModalOpen, setImportModalOpen,
    importing, importPayload, setImportPayload, initialValues,
    fetchConfig, handleExport, handleImportConfirm, readFileText,
  };
}
