import { describe, expect, it } from 'vitest';
import { offerSource } from '../shared/offer-source';
import { formatMoney } from '../src/panel/components/ui';

describe('retailer-neutral product presentation', () => {
  it('labels the reference website without inventing a merchant', () => {
    expect(offerSource({ referenceUrl: 'https://www.amazon.com/product/123', sourceUrl: null, dataOrigin: 'sample' }))
      .toEqual({ label: 'amazon.com', url: 'https://www.amazon.com/product/123' });
    expect(offerSource({ sourceUrl: 'https://store.example/products/123', dataOrigin: 'retrieved' }).label).toBe('store.example');
    expect(offerSource({ sourceUrl: null, dataOrigin: 'sample' })).toEqual({ label: 'Needle catalog', url: null });
  });

  it('does not link unsafe or malformed stored sources', () => {
    for (const referenceUrl of ['javascript:alert(1)', 'https://user:password@shop.example/product', 'not a URL']) {
      expect(offerSource({ referenceUrl, sourceUrl: null, dataOrigin: 'retrieved' }).url).toBeNull();
    }
  });

  it('preserves the currency code and native precision for different currencies', () => {
    expect(formatMoney(49.99, 'EUR')).toContain('EUR');
    expect(formatMoney(49000, 'KRW')).toContain('49,000');
    expect(formatMoney(12.345, 'KWD')).toContain('12.345');
    expect(formatMoney(12.345, 'KWD')).toContain('KWD');
  });
});
