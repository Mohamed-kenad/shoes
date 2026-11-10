import { describe, expect, it } from 'vitest';
import { formatBagCount, formatPrice, formatSize, priceToCents } from '../src/lib/format';

describe('format helpers', () => {
  it('formats whole-euro prices without decimals', () => {
    expect(formatPrice(155)).toBe('€155');
  });

  it('keeps fractional prices when present', () => {
    expect(formatPrice(155.5)).toBe('€155.50');
  });

  it('formats half sizes with one decimal at most', () => {
    expect(formatSize(36.5)).toBe('36.5');
    expect(formatSize(38)).toBe('38');
  });

  it('pads the bag count to two digits', () => {
    expect(formatBagCount(0)).toBe('(00)');
    expect(formatBagCount(9)).toBe('(09)');
    expect(formatBagCount(10)).toBe('(10)');
    expect(formatBagCount(100)).toBe('(100)');
  });

  it('converts catalogue prices to integer cents', () => {
    expect(priceToCents(155)).toBe(15_500);
    expect(priceToCents(155.5)).toBe(15_550);
  });
});
