/** Only real product-detail links can appear as live offers. Search/category pages are not offers. */
export function isCoupangProductUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && ['www.coupang.com', 'coupang.com', 'm.coupang.com', 'www.tw.coupang.com', 'tw.coupang.com'].includes(url.hostname)
      && /^\/(?:vp\/)?products\/\d+\/?$/.test(url.pathname);
  } catch { return false; }
}

export function publicImageUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (!host.includes('.') || /^(?:localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/.test(host)
      || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) || host.endsWith('.local') || host.endsWith('.internal')) return null;
    return url.href;
  } catch { return null; }
}

export const normalize = (text: string): string => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const evidenceText = (value: string): string => value.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();

export function containsEvidence(source: string, evidence: string | null): evidence is string {
  // Preserve punctuation: “49,000” and “49.000” must never become the same quotation.
  return !!evidence?.trim() && evidenceText(source).includes(evidenceText(evidence));
}

function identifierPattern(identifier: string): string | null {
  const characters = [...identifier.toLocaleLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '')];
  if (characters.length < 2) return null;
  return `(?<![\\p{L}\\p{N}])${characters.join('[\\s._-]*')}(?![\\p{L}\\p{N}])`;
}

export function hasIdentifier(source: string, identifier: string | null | undefined): boolean {
  const pattern = identifier && identifierPattern(identifier);
  return !!pattern && new RegExp(pattern, 'iu').test(source);
}

/** A base model cannot authorize an exact claim for a model with a different version suffix. */
export function matchesModel(source: string, model: string | null | undefined): boolean {
  const pattern = model && identifierPattern(model);
  if (!pattern) return false;
  const matches = [...source.matchAll(new RegExp(pattern, 'giu'))];
  if (!matches.length) return false;
  const suffix = /^[\s._-]+(?:pro|plus|max|ultra|mini|lite|se|mk\s*\d+|mark\s*\d+|gen(?:eration)?\s*\d+|ii|iii|iv|v\d+)(?![\p{L}\p{N}])/iu;
  // Reject mixed evidence too: a quote that contains both a base and a modified model is ambiguous.
  return matches.every(match => !suffix.test(source.slice((match.index ?? 0) + match[0].length)));
}

/** Prices need both an amount and an unambiguous currency in the same quoted source evidence. */
export function verifiedPrice(source: string, amount: number | null, currency: string | null, evidence: string | null): { price: number | null; currency: string | null } {
  if (amount === null || !Number.isFinite(amount) || amount < 0 || !currency || !containsEvidence(source, evidence)) return { price: null, currency: null };
  const code = currency.toUpperCase();
  const currencyPatterns: Record<string, RegExp> = {
    KRW: /(?:\bKRW\b|₩|원)/i,
    USD: /(?:\bUSD\b|US\$)/i,
    SGD: /(?:\bSGD\b|S\$|SG\$)/i,
    TWD: /(?:\bTWD\b|NT\$|新台幣)/i,
    EUR: /(?:\bEUR\b|€)/i,
    GBP: /(?:\bGBP\b|£)/i,
    JPY: /(?:\bJPY\b|円)/i,
    AUD: /(?:\bAUD\b|A\$|AU\$)/i,
    CAD: /(?:\bCAD\b|CA\$|C\$)/i,
    CNY: /(?:\bCNY\b|人民币)/i,
  };
  if (!/^[A-Z]{3}$/.test(code)) return { price: null, currency: null };
  const pattern = currencyPatterns[code] ?? new RegExp(`\\b${code}\\b`, 'i');
  if (!pattern.test(evidence)) return { price: null, currency: null };
  // Currency must sit directly beside the amount, not elsewhere in a sentence containing unrelated digits.
  const numberPattern = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?';
  const adjacent = new RegExp(`(?:${pattern.source})\\s*(${numberPattern})(?![\\d,.])|(?<![\\d,.])(${numberPattern})\\s*(?:${pattern.source})`, 'gi');
  const values = [...evidence.matchAll(adjacent)].map(match => Number((match[1] ?? match[2]).replace(/,/g, '')));
  if (!values.includes(amount)) return { price: null, currency: null };
  return { price: amount, currency: code };
}
