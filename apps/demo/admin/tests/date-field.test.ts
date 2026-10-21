/**
 * `toContractDate` — 出参日期归一回归。
 *
 * 真实故障：AI 预填给出 ISO `1996-10-02T00:00:00.000Z`，原样提交后
 * `POST /api/v1/admin/users/` 被 ajv 以 `format "date"` 拒掉（400 / 21001）。
 * 后端 `draft-field-format` 有归一，但它只在草稿写入与比较入口生效，
 * 接不到被 ajv 先拒掉的请求体 —— 所以出参这一侧必须自己折。
 *
 * 与后端 `canonicalDateOnly` 保持同一语义：取字面日期部分，不做时区换算。
 */
import { toContractDate } from '@yishan/core-system-admin/date-field';

describe('toContractDate', () => {
  it.each([
    ['1996-10-02', '1996-10-02'],
    ['1996-10-02T00:00:00.000Z', '1996-10-02'],
    ['1996-10-02T23:59:59-05:00', '1996-10-02'],
    ['1996-10-02 08:30:00', '1996-10-02'],
    ['  1996-10-02  ', '1996-10-02'],
  ])('折 %s → %s', (input, expected) => {
    expect(toContractDate(input)).toBe(expected);
  });

  it.each([
    ['1996-02-31', '日历上不存在，原样透传交给后端报错'],
    ['1996-13-01', '月份越界，原样透传'],
    ['1996-10-02abc', '日期后不是时间，原样透传'],
    ['', '空串不是日期，原样透传'],
    ['not-a-date', '非日期，原样透传'],
  ])('认不出的 %s 原样返回（%s）', (input) => {
    expect(toContractDate(input)).toBe(input);
  });

  it.each([undefined, null, 123, {}, ['1996-10-02']])(
    '非字符串 %p 原样返回，不做任何转换',
    (input) => {
      expect(toContractDate(input)).toBe(input);
    },
  );

  it('闰年判定：2000-02-29 折成规范形式，1900 不是闰年所以透传', () => {
    expect(toContractDate('2000-02-29')).toBe('2000-02-29');
    expect(toContractDate('1900-02-29')).toBe('1900-02-29');
  });
});
