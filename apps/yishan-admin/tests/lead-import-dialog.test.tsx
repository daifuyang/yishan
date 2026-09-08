import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LeadImportDialog from '@/modules/crm/pages/lead-pool/LeadImportDialog';

describe('LeadImportDialog', () => {
  it('vertically centers the modal in the viewport', async () => {
    render(
      <LeadImportDialog
        open
        importing={false}
        onOpenChange={() => undefined}
        onImport={async () => false}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('.ant-modal-wrap')?.classList.contains('ant-modal-centered')).toBe(true);
    });
  });

  it('uses an upload-first layout with concise guidance', async () => {
    render(
      <LeadImportDialog
        open
        importing={false}
        onOpenChange={() => undefined}
        onImport={async () => false}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('.ant-alert')).toBeNull();
    });

    expect(screen.getByText('联系人为必填项，其余字段请按模板填写。导入成功后，数据将进入线索池。')).toBeTruthy();
    expect(screen.getByRole('button', { name: /下载导入模板/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /关\s*闭/ })).toBeNull();
    expect(document.querySelector('.ant-upload-wrapper')?.getAttribute('style') ?? '').not.toContain('margin');
  });
});
