import * as XLSX from 'xlsx';
import type { LeadCreateInput } from '@/services/crm';

export interface LeadImportError {
  row: number;
  message: string;
}

export interface LeadImportParseResult {
  rows: LeadCreateInput[];
  errors: LeadImportError[];
}

const COLUMN_MAP: Record<string, Exclude<keyof LeadCreateInput, 'sourceId'>> = {
  联系人: 'name',
  公司名称: 'companyName',
  手机号: 'mobile',
  手机: 'mobile',
  电话: 'phone',
  邮箱: 'email',
  微信: 'wechat',
  QQ: 'qq',
  意向说明: 'intention',
};

const trimCell = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text || undefined;
};

/** 解析导入表的首个工作表；表头采用系统中文字段名。 */
export async function parseLeadImportFile(file: File): Promise<LeadImportParseResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { rows: [], errors: [{ row: 1, message: '未找到可导入的数据表' }] };
  const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheetName], { defval: '' });
  if (!sourceRows.length) return { rows: [], errors: [{ row: 1, message: '导入文件没有数据' }] };
  if (sourceRows.length > 500) return { rows: [], errors: [{ row: 1, message: '单次最多导入 500 条线索' }] };

  const rows: LeadCreateInput[] = [];
  const errors: LeadImportError[] = [];
  sourceRows.forEach((source, index) => {
    const item: LeadCreateInput = {};
    Object.entries(source).forEach(([column, value]) => {
      const field = COLUMN_MAP[column.trim()];
      const text = trimCell(value);
      if (field && text) item[field] = text;
    });
    if (!item.name?.trim()) {
      errors.push({ row: index + 2, message: '请输入联系人姓名' });
      return;
    }
    rows.push(item);
  });
  return { rows, errors };
}

/** 生成与解析器字段完全一致的空白模板。 */
export function downloadLeadImportTemplate(): void {
  const sheet = XLSX.utils.json_to_sheet([
    { 联系人: '张三', 公司名称: '示例公司', 手机号: '13800000000', 电话: '', 邮箱: '', 微信: '', QQ: '', 意向说明: '请填写客户需求或咨询内容' },
  ]);
  sheet['!cols'] = [
    { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 16 },
    { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 36 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '线索导入');
  XLSX.writeFile(workbook, '线索导入模板.xlsx');
}
