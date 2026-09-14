import { Button, Empty, List, Popconfirm, Upload, message } from 'antd';
import React, { useCallback, useEffect, useState } from 'react';
import { createCrmAttachment, deleteCrmAttachment, listCrmAttachments, type CrmAttachmentRow } from '@/services/crm';
import { uploadAttachmentFile } from '@/utils/attachmentUpload';

const AttachmentsTab: React.FC<{ customerId: number }> = ({ customerId }) => {
  const [items, setItems] = useState<CrmAttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listCrmAttachments(customerId)); } catch { setItems([]); } finally { setLoading(false); }
  }, [customerId]);
  useEffect(() => { void load(); }, [load]);
  const upload = async (options: any) => {
    try {
      const result: any = await uploadAttachmentFile(options.file as File, { name: (options.file as File).name, dir: 'crm' });
      const attachmentId = Number(result?.data?.id ?? result?.data?.items?.[0]?.id ?? result?.id);
      if (!attachmentId) throw new Error('上传未返回附件 ID');
      await createCrmAttachment({ customerId, entityType: 'customer', entityId: customerId, attachmentId });
      await load();
      options.onSuccess?.(result);
      message.success('附件已添加');
    } catch (error) {
      options.onError?.(error as Error);
      message.error((error as Error).message || '附件上传失败');
    }
  };
  return <div style={{ padding: '16px 0' }}>
    <Upload showUploadList={false} customRequest={upload}><Button type="primary">上传附件</Button></Upload>
    {items.length === 0 && !loading ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无附件" style={{ margin: '32px 0' }} /> : <List loading={loading} dataSource={items} renderItem={(item) => <List.Item actions={[<Popconfirm key="delete" title="确认移除附件？" onConfirm={async () => { await deleteCrmAttachment(item.id); await load(); }}><a>移除</a></Popconfirm>]}>{item.url ? <a href={item.url} target="_blank" rel="noreferrer">{item.name || `附件 #${item.attachmentId}`}</a> : item.name || `附件 #${item.attachmentId}`}</List.Item>} />}
  </div>;
};
export default AttachmentsTab;
