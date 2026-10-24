import { describe, expect, it } from 'vitest';
import { contextTags, sourceOrigin } from '../shared/context';
import { intentTags } from '../shared/intent';

describe('bounded context taxonomy', () => {
  it('keeps meal preparation and cycle commuting separate until the intent engine stitches them', () => {
    expect(contextTags('A meal-prep recipe for weekday lunches')).toEqual(['meal-prep']);
    expect(contextTags('A guide to cycling to work')).toEqual(['cycle-commute']);
  });
  it('does not label unrelated browsing as commercial intent', () => {
    for (const text of ['Weather tomorrow', 'Cycling race highlights', 'Work deadlines', 'Cats playing in a garden', 'A lunch break conversation']) expect(contextTags(text)).toEqual([]);
  });
  it('does not turn audio or portability alone into recording or meal-prep intent', () => {
    expect(contextTags('Wireless headphones for music')).toEqual(['audio']);
    expect(contextTags('Portable umbrella')).toEqual(['portable']);
    expect(contextTags('A compact desk')).toEqual(['small-space']);
  });
  it('returns only deduplicated allowlisted tags for mixed context', () => {
    const tags = contextTags('Meal prep with a lunch container. Cycling to work. A portable microphone for recording audio on a small desk.');
    expect(tags).toHaveLength(6);
    expect(tags.every(tag => (intentTags as readonly string[]).includes(tag))).toBe(true);
    expect(new Set(tags).size).toBe(tags.length);
  });
  it('reduces public page references to origins and rejects non-web schemes', () => {
    expect(sourceOrigin('https://recipes.example/private/path?token=abc#section')).toBe('https://recipes.example');
    for (const value of [undefined, '', 'not a url', 'file:///private/test', 'javascript:alert(1)', 'chrome://settings']) expect(sourceOrigin(value)).toBeUndefined();
  });
});
