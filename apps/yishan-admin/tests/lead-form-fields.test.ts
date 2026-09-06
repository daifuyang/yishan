import {
  LEAD_FORM_PRIMARY_FIELDS,
  validateMobile,
  validateRequiredName,
} from '../src/modules/crm/pages/leads/leadForm';

describe('LeadForm 字段配置', () => {
  it('create 模式不包含 sourceId', () => {
    const createFields = LEAD_FORM_PRIMARY_FIELDS.filter((f) => f.modes.includes('create'));
    expect(createFields.map((f) => f.name)).toEqual([
      'name',
      'companyName',
      'mobile',
      'wechat',
      'phone',
      'qq',
      'email',
      'intention',
    ]);
  });

  it('edit 模式额外包含 sourceId', () => {
    const editFields = LEAD_FORM_PRIMARY_FIELDS.filter((f) => f.modes.includes('edit'));
    expect(editFields.map((f) => f.name)).toEqual([
      'name',
      'companyName',
      'mobile',
      'wechat',
      'phone',
      'qq',
      'email',
      'sourceId',
      'intention',
    ]);
  });

  it('联系人 name 是 create+edit 唯一 required 字段', () => {
    const requiredFields = LEAD_FORM_PRIMARY_FIELDS.filter((f) => f.required);
    expect(requiredFields.map((f) => f.name)).toEqual(['name']);
  });
});

describe('LeadForm 字段级校验', () => {
  it('validateRequiredName 在空字符串 / 空白上抛错', async () => {
    await expect(validateRequiredName({}, '')).rejects.toThrow('请输入联系人姓名');
    await expect(validateRequiredName({}, '   ')).rejects.toThrow('请输入联系人姓名');
    await expect(validateRequiredName({}, '张三')).resolves.toBeUndefined();
  });

  it('validateMobile 空值放行；11 位 1 开头通过；其他抛错', async () => {
    await expect(validateMobile({}, undefined)).resolves.toBeUndefined();
    await expect(validateMobile({}, '')).resolves.toBeUndefined();
    await expect(validateMobile({}, '13800138000')).resolves.toBeUndefined();
    await expect(validateMobile({}, '23800138000')).rejects.toThrow('请输入正确的手机号');
    await expect(validateMobile({}, '1380013800')).rejects.toThrow('请输入正确的手机号');
  });
});