import * as XLSX from 'xlsx';
import { parseLeadImportFile } from '@/modules/crm/pages/lead-pool/leadImport';
import { LEAD_IMPORT_HELP } from '@/modules/crm/pages/lead-pool/LeadImportDialog';

describe('parseLeadImportFile', () => {
  it('reads supported columns and reports rows without a contact name', async () => {
    const sheet = XLSX.utils.json_to_sheet([
      { 联系人: '李女士', 公司名称: '示例公司', 手机号: '13800000000', 邮箱: 'li@example.com', 微信: 'lili', 意向说明: '预约演示' },
      { 联系人: '  ', 公司名称: '缺少联系人公司' },
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, '线索');
    const content = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
    const file = {
      arrayBuffer: async () => content,
    } as unknown as File;

    await expect(parseLeadImportFile(file)).resolves.toEqual({
      rows: [{ name: '李女士', companyName: '示例公司', mobile: '13800000000', email: 'li@example.com', wechat: 'lili', intention: '预约演示' }],
      errors: [{ row: 3, message: '请输入联系人姓名' }],
    });
  });

  it('limits one import to 500 rows', async () => {
    const sheet = XLSX.utils.json_to_sheet(
      Array.from({ length: 501 }, (_, index) => ({ 联系人: `联系人 ${index + 1}` })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, '线索');
    const content = XLSX.write(book, { type: 'array', bookType: 'xlsx' });

    await expect(parseLeadImportFile({ arrayBuffer: async () => content } as File)).resolves.toEqual({
      rows: [],
      errors: [{ row: 1, message: '单次最多导入 500 条线索' }],
    });
  });
});

describe('线索池导入说明', () => {
  it('以两条简洁规则说明字段、导入上限和入池规则', () => {
    expect(LEAD_IMPORT_HELP).toEqual([
      '联系人为必填项，其余字段请按模板填写。导入成功后，数据将进入线索池。',
      '支持 .xlsx、.xls、.csv，单次最多 500 条。',
    ]);
  });
});
