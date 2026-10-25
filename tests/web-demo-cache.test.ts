import { mkdtempSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { NeedleDatabase } from '../server/storage/database.js';
import { SampleProvider } from '../server/providers/catalog.js';
import type { Interpretation, Offer } from '../shared/types.js';

const item: Interpretation = { name: 'Black F-style electric mandolin', productType: 'mandolin', brand: 'Kentucky', model: 'KM-1500', color: 'Black', attributes: ['F-style', 'electric'], queries: ['black F-style electric mandolin'], needsClarification: false, clarification: null };
const offer: Offer = { id: 'web-demo-mandolin', title: 'Black F-style electric mandolin', description: 'F-style electric mandolin', imageUrl: null, sourceUrl: null, referenceUrl: 'https://shop.example.com/products/mandolin', priceIsIllustrative: true, match: 'similar', matchEvidence: 'The source describes an electric mandolin.', price: 129000, currency: 'KRW', observedAt: '2026-10-25T00:00:00Z', dataOrigin: 'sample', variants: [], shipping: null, availability: null, returns: null, reason: 'A related instrument.', differences: ['Model is unconfirmed.'] };
const databases: NeedleDatabase[] = [];
const memory = () => { const db = new NeedleDatabase(); databases.push(db); return db; };
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

describe('web-derived demo catalog cache', () => {
  it('stores a product reference and keeps unsupported brand/model out of the catalog', () => {
    const db = memory();
    const count = db.catalog().length;
    expect(db.cacheWebOffers(item, [offer])).toEqual([offer]);
    const saved = db.catalog().find(product => product.id === offer.id);
    expect(db.catalog()).toHaveLength(count + 1);
    expect(saved).toMatchObject({ brand: '', model: '', productType: 'mandolin', color: 'Black', price: 129000, currency: 'KRW', referenceUrl: offer.referenceUrl, priceIsIllustrative: true, imageUrl: '' });
    expect(saved?.tags).not.toContain('Kentucky');
  });

  it('reuses the first price, currency, and price provenance for repeated offers', () => {
    const db = memory();
    db.cacheWebOffers(item, [offer]);
    const result = db.cacheWebOffers(item, [{ ...offer, price: 100, currency: 'USD', priceIsIllustrative: false, observedAt: '2026-10-26T00:00:00Z' }]);
    expect(result[0]).toMatchObject({ price: 129000, currency: 'KRW', priceIsIllustrative: true, observedAt: offer.observedAt });
    expect(db.catalog().filter(product => product.id === offer.id)).toHaveLength(1);
  });

  it('returns cached web matches through ordinary catalog search with their original source and price flag', async () => {
    const db = memory();
    db.cacheWebOffers(item, [offer, { ...offer, id: 'web-demo-other-mandolin', title: 'Another electric mandolin', description: '', referenceUrl: 'https://shop.example.com/products/second' }]);
    const provider = new SampleProvider(() => db.catalog());
    const result = await provider.search(item, {}, new AbortController().signal);
    expect(result.offers).toHaveLength(2);
    expect(result.offers[0]).toMatchObject({ id: offer.id, referenceUrl: offer.referenceUrl, priceIsIllustrative: true, dataOrigin: 'sample', sourceUrl: null, imageUrl: null, observedAt: offer.observedAt });
    expect(result.offers[1].reason).toBe('Another option to compare with your selection.');
    expect(result.offers[0].differences.join(' ')).not.toContain('Different model: .');
    const budget = await provider.search(item, { budget: 100, currency: 'USD' }, new AbortController().signal);
    expect(budget.offers).toEqual([]);
  });

  it('does not persist live listings, private references, or overwrite a prepared product', () => {
    const db = memory();
    const prepared = db.catalog()[0];
    const count = db.catalog().length;
    db.cacheWebOffers(item, [
      { ...offer, id: 'live-item', dataOrigin: 'retrieved', sourceUrl: 'https://www.coupang.com/vp/products/123' },
      { ...offer, id: 'private-item', referenceUrl: 'https://127.0.0.1/product' },
      { ...offer, id: prepared.id },
    ]);
    expect(db.catalog()).toHaveLength(count);
    expect(db.catalog()[0]).toEqual(prepared);
  });

  it('keeps prepared catalog records free of web-derived metadata', async () => {
    const result = await new SampleProvider().search({ ...item, name: 'headphones', productType: 'headphones', brand: null, model: null, attributes: [] }, {});
    expect(result.offers).toHaveLength(3);
    for (const resultOffer of result.offers) {
      expect(resultOffer).not.toHaveProperty('referenceUrl');
      expect(resultOffer).not.toHaveProperty('priceIsIllustrative');
    }
  });

  it('preserves web records and their stable prices when SQLite reopens', () => {
    const directory = mkdtempSync(join(tmpdir(), 'needle-web-cache-'));
    const file = join(directory, 'catalog.sqlite');
    let db: NeedleDatabase | undefined;
    try {
      db = new NeedleDatabase(file);
      db.cacheWebOffers(item, [offer]);
      db.close();
      db = new NeedleDatabase(file);
      const repeated = db.cacheWebOffers(item, [{ ...offer, price: 999000 }]);
      expect(repeated[0].price).toBe(129000);
      expect(db.catalog().find(product => product.id === offer.id)?.referenceUrl).toBe(offer.referenceUrl);
    } finally {
      db?.close();
      for (const name of readdirSync(directory)) unlinkSync(join(directory, name));
      rmdirSync(directory);
    }
  });
});
