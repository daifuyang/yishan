import { CloseOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Modal, Upload, theme } from 'antd';
import React from 'react';
import './LeadImportDialog.less';
import { downloadLeadImportTemplate } from './leadImport';

export const LEAD_IMPORT_HELP = [
  '联系人为必填项，其余字段请按模板填写。导入成功后，数据将进入线索池。',
  '支持 .xlsx、.xls、.csv，单次最多 500 条。',
] as const;

export default function LeadImportDialog({
  open,
  importing,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  importing: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (file: File) => Promise<boolean>;
}) {
  const { token } = theme.useToken();

  return (
    <Modal
      title={<span className="lead-import-dialog__title">批量导入线索</span>}
      open={open}
      centered
      width={640}
      className="lead-import-dialog"
      style={{
        maxWidth: 'calc(100vw - 32px)',
        '--lead-import-primary': token.colorPrimary,
        '--lead-import-primary-bg': token.colorPrimaryBg,
        '--lead-import-text': token.colorText,
        '--lead-import-text-secondary': token.colorTextSecondary,
        '--lead-import-text-tertiary': token.colorTextTertiary,
        '--lead-import-border': token.colorBorderSecondary,
        '--lead-import-fill': token.colorFillAlter,
      } as React.CSSProperties}
      closeIcon={<CloseOutlined />}
      onCancel={() => onOpenChange(false)}
      footer={null}
      destroyOnHidden
      styles={{
        content: { borderRadius: token.borderRadiusLG, boxShadow: '0 12px 40px rgba(0, 0, 0, 0.10)' },
        body: { padding: '16px 0 0' },
      }}
    >
      <div className="lead-import-dialog__body">
        <Upload.Dragger
          accept=".xlsx,.xls,.csv"
          maxCount={1}
          showUploadList={false}
          disabled={importing}
          beforeUpload={onImport}
          className="lead-import-dialog__dragger"
        >
          <div className="lead-import-dialog__upload-content">
            <div className="lead-import-dialog__upload-icon"><UploadOutlined /></div>
            <div className="lead-import-dialog__upload-title">点击或拖拽文件至此处上传</div>
            <div className="lead-import-dialog__upload-hint">{LEAD_IMPORT_HELP[1]}</div>
          </div>
        </Upload.Dragger>
        <div className="lead-import-dialog__help">
          <div className="lead-import-dialog__help-text">{LEAD_IMPORT_HELP[0]}</div>
          <Button className="lead-import-dialog__template-button" type="link" icon={<DownloadOutlined />} onClick={downloadLeadImportTemplate}>
            下载导入模板
          </Button>
        </div>
      </div>
    </Modal>
  );
}
