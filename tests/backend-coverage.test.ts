import { describe, expect, it } from 'vitest';
import { coverageCases, hasCoverageEvidence } from '../server/coverage.js';

const source = (title: string, text = title) => ({ title, text, url: 'https://store.example.com/products/123' });

describe('live-discovery coverage gate', () => {
  it.each([
    [0, 'Sony WH-1000XM5 headphones'],
    [1, 'Fjallraven Kanken backpack'],
    [1, '피엘라벤 칸켄 백팩'],
    [2, '이케아 테르티알 작업등'],
    [3, 'Logitech MX Master 3S mouse'],
    [3, '로지텍 MX MASTER 3S 마우스'],
    [4, '레고 10329'],
  ])('recognizes target %s from its explicit identity: %s', (index, title) => {
    expect(hasCoverageEvidence(source(String(title)), coverageCases[Number(index)])).toBe(true);
  });

  it.each([
    [0, 'Sony WH-1000XM50 headphones'],
    [1, 'Fjallraven Kanken Mini backpack'],
    [2, 'IKEA unrelated lamp'],
    [3, 'Logitech MX Master 3 mouse'],
    [4, 'LEGO 10328'],
    [4, 'LEGO botanical collection'],
  ])('rejects wrong or missing model identity for target %s: %s', (index, title) => {
    expect(hasCoverageEvidence(source(String(title)), coverageCases[Number(index)])).toBe(false);
  });

  it('requires usable content and a public HTTPS source without retailer restrictions', () => {
    expect(hasCoverageEvidence(source('LEGO 10329', ''), coverageCases[4])).toBe(false);
    expect(hasCoverageEvidence({ ...source('LEGO 10329'), url: 'https://another-store.example/items/123' }, coverageCases[4])).toBe(true);
    expect(hasCoverageEvidence({ ...source('LEGO 10329'), url: 'https://127.0.0.1/product/123' }, coverageCases[4])).toBe(false);
    expect(hasCoverageEvidence({ ...source('LEGO 10329'), url: 'http://store.example.com/product/123' }, coverageCases[4])).toBe(false);
    expect(hasCoverageEvidence(source('Unbranded 10329'), coverageCases[4])).toBe(false);
  });
});
