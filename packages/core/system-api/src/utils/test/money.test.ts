import { describe, it, expect } from 'vitest'
import { Money, yuanToCents, centsToYuan, parseYuanString, sumCents, computeLineAmountCents, formatCents } from '../money.js'

describe('Money', () => {
  describe('yuanToCents', () => {
    it('converts whole yuan', () => {
      expect(yuanToCents(12)).toBe(1200)
      expect(yuanToCents(0)).toBe(0)
      expect(yuanToCents(-12)).toBe(-1200)
    })
    it('rounds half-up to 2 decimals', () => {
      // 12.345 → 1234.5 → 1235
      expect(yuanToCents(12.345)).toBe(1235)
      expect(yuanToCents(12.344)).toBe(1234)
    })
    it('handles 0.005 boundary', () => {
      expect(yuanToCents(0.005)).toBe(1)
      expect(yuanToCents(0.004)).toBe(0)
    })
    it('rejects non-finite', () => {
      expect(() => yuanToCents(NaN)).toThrow(RangeError)
      expect(() => yuanToCents(Infinity)).toThrow(RangeError)
    })
    it('rejects values that overflow safe integer', () => {
      expect(() => yuanToCents(Number.MAX_SAFE_INTEGER / 100 + 1)).toThrow(RangeError)
    })
  })

  describe('centsToYuan', () => {
    it('is precise for integer cents', () => {
      expect(centsToYuan(1234)).toBe(12.34)
      expect(centsToYuan(0)).toBe(0)
      expect(centsToYuan(-100)).toBe(-1)
    })
    it('rejects unsafe integer', () => {
      expect(() => centsToYuan(Number.MAX_SAFE_INTEGER + 100)).toThrow(RangeError)
    })
  })

  describe('parseYuanString', () => {
    it('handles plain numbers', () => {
      expect(parseYuanString('12')).toBe(1200)
      expect(parseYuanString('12.3')).toBe(1230)
      expect(parseYuanString('12.34')).toBe(1234)
    })
    it('handles negatives', () => {
      expect(parseYuanString('-12.34')).toBe(-1234)
    })
    it('handles 4-decimal precision', () => {
      expect(parseYuanString('12.3456')).toBe(1235)
    })
    it('returns null for empty / null / undefined', () => {
      expect(parseYuanString('')).toBeNull()
      expect(parseYuanString('   ')).toBeNull()
      expect(parseYuanString(null)).toBeNull()
      expect(parseYuanString(undefined)).toBeNull()
    })
    it('rejects garbage', () => {
      expect(() => parseYuanString('abc')).toThrow(RangeError)
      expect(() => parseYuanString('12.34567')).toThrow(RangeError)
      expect(() => parseYuanString('12,34')).toThrow(RangeError)
    })
  })

  describe('sumCents', () => {
    it('sums an array', () => {
      expect(sumCents([100, 200, 300])).toBe(600)
    })
    it('returns 0 for empty', () => {
      expect(sumCents([])).toBe(0)
    })
    it('avoids floating-point drift in practice', () => {
      // 0.1 + 0.2 in yuan would give 0.30000000000000004 in JS,
      // but in cents it's exact: 10 + 20 = 30
      expect(sumCents([10, 20])).toBe(30)
    })
    it('rejects non-integer entries', () => {
      expect(() => sumCents([1.5 as unknown as number])).toThrow(RangeError)
    })
  })

  describe('computeLineAmountCents', () => {
    it('basic line: qty=1, no discount, no tax', () => {
      expect(computeLineAmountCents({
        qty: 10000, // 1.0000 件
        unitPriceCents: 1234, // ¥12.34
        discountBp: 0,
        taxRateBp: 0,
      })).toBe(1234)
    })
    it('10% discount, 13% tax', () => {
      // 10000 × 10000 × 0.9 × 1.13 = 10170 cents
      expect(computeLineAmountCents({
        qty: 10000,
        unitPriceCents: 10000,
        discountBp: 1000, // 10%
        taxRateBp: 1300, // 13%
      })).toBe(10170)
    })
    it('100% discount → 0', () => {
      expect(computeLineAmountCents({
        qty: 10000,
        unitPriceCents: 9999,
        discountBp: 10000,
        taxRateBp: 0,
      })).toBe(0)
    })
    it('rejects out-of-range bp', () => {
      expect(() => computeLineAmountCents({
        qty: 10000, unitPriceCents: 1, discountBp: -1, taxRateBp: 0,
      })).toThrow(RangeError)
      expect(() => computeLineAmountCents({
        qty: 10000, unitPriceCents: 1, discountBp: 0, taxRateBp: 10001,
      })).toThrow(RangeError)
    })
  })

  describe('formatCents', () => {
    it('zh-CN with symbol', () => {
      expect(formatCents(123456)).toBe('¥1,234.56')
    })
    it('zh-CN without symbol', () => {
      expect(formatCents(123456, { withSymbol: false })).toBe('1,234.56')
    })
    it('handles zero', () => {
      expect(formatCents(0)).toBe('¥0.00')
    })
    it('handles negative', () => {
      expect(formatCents(-123456, { signed: true })).toBe('-¥1,234.56')
    })
  })

  describe('namespace re-export', () => {
    it('Money.yuanToCents matches module export', () => {
      expect(Money.yuanToCents).toBe(yuanToCents)
      expect(Money.sumCents).toBe(sumCents)
    })
  })
})
