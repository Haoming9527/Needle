export function extractFirstUrl(text?: string): string | undefined {
  if (!text) return undefined;
  return text.match(/https?:\/\/[^\s]+/i)?.[0];
}

export function getDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, "");
  } catch {
    return "unknown";
  }
}

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = "";

    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|spm|aff_|ref)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }

    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

export function detectMarketplace(rawUrl: string): string {
  const url = rawUrl.toLowerCase();

  if (url.includes("shopee")) return "Shopee";
  if (url.includes("lazada")) return "Lazada";
  if (url.includes("taobao")) return "Taobao";
  if (url.includes("amazon")) return "Amazon";
  if (url.includes("aliexpress")) return "AliExpress";
  if (url.includes("carousell")) return "Carousell";

  return "Web";
}

export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function shopeeSearchUrl(query: string): string {
  return `https://shopee.sg/search?keyword=${encodeURIComponent(query)}`;
}

export function lazadaSearchUrl(query: string): string {
  return `https://www.lazada.sg/catalog/?q=${encodeURIComponent(query)}`;
}

export function taobaoSearchUrl(query: string): string {
  return `https://s.taobao.com/search?q=${encodeURIComponent(query)}`;
}
