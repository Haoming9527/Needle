import * as cheerio from "cheerio";
import { extractPrice } from "../lib/currency.js";
import { logger } from "../lib/logger.js";
import type { ProductCandidate, ProductIdentification } from "../types/needle.js";

type PageProductData = {
  title?: string;
  imageUrl?: string;
  priceText?: string;
  currency?: string;
  priceValue?: number;
  isPurchasable?: boolean;
};

export async function enrichCandidatesWithPageData(
  identification: ProductIdentification,
  candidates: ProductCandidate[]
): Promise<ProductCandidate[]> {
  const targets = candidates.slice(0, 8);
  const enriched = await Promise.all(
    targets.map(async (candidate) => enrichCandidate(identification, candidate))
  );

  return [...enriched, ...candidates.slice(targets.length)];
}

async function enrichCandidate(
  identification: ProductIdentification,
  candidate: ProductCandidate
): Promise<ProductCandidate> {
  const official = isOfficialSource(identification, candidate);

  try {
    const page = await fetchPageProductData(candidate.url);
    const price =
      page.priceText && page.priceValue
        ? {
            priceText: page.priceText,
            currency: page.currency,
            priceValue: page.priceValue
          }
        : undefined;

    return {
      ...candidate,
      title: page.title ?? candidate.title,
      imageUrl: page.imageUrl ?? candidate.imageUrl,
      priceText: price?.priceText ?? candidate.priceText,
      currency: price?.currency ?? candidate.currency,
      priceValue: price?.priceValue ?? candidate.priceValue,
      isOfficialSource: official,
      isPurchasable: page.isPurchasable ?? Boolean(price ?? candidate.priceText)
    };
  } catch (error) {
    logger.debug(
      { error: error instanceof Error ? error.message : error, url: candidate.url },
      "Candidate page enrichment skipped"
    );

    return {
      ...candidate,
      isOfficialSource: official,
      isPurchasable: Boolean(candidate.priceText)
    };
  }
}

async function fetchPageProductData(url: string): Promise<PageProductData> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; NeedleBot/1.0; +https://example.local/needle)"
    },
    signal: AbortSignal.timeout(4_000)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Unsupported content type ${contentType}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const jsonLd = extractJsonLdProductData($);
  const meta = extractMetaProductData($);
  const title = cleanText(jsonLd.title ?? meta.title ?? $("title").first().text());
  const imageUrl = jsonLd.imageUrl ?? meta.imageUrl;
  const price = jsonLd.priceText ? jsonLd : meta.priceText ? meta : undefined;

  return {
    title,
    imageUrl,
    priceText: price?.priceText,
    currency: price?.currency,
    priceValue: price?.priceValue,
    isPurchasable: Boolean(price?.priceText)
  };
}

function extractJsonLdProductData($: cheerio.CheerioAPI): PageProductData {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(script).contents().text().trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const products = flattenJsonLd(parsed).filter(isProductLike);

      for (const product of products) {
        const offer = firstOffer(product.offers);
        const priceValue = numberFromUnknown(offer?.price);
        const currency = stringFromUnknown(offer?.priceCurrency);

        return {
          title: stringFromUnknown(product.name),
          imageUrl: imageFromUnknown(product.image),
          priceText:
            priceValue && currency
              ? `${currency.toUpperCase()} ${priceValue.toFixed(priceValue % 1 === 0 ? 0 : 2)}`
              : undefined,
          currency: currency?.toUpperCase(),
          priceValue,
          isPurchasable: Boolean(priceValue && currency)
        };
      }
    } catch {
      continue;
    }
  }

  return {};
}

function extractMetaProductData($: cheerio.CheerioAPI): PageProductData {
  const title = attr($, 'meta[property="og:title"]', "content");
  const imageUrl = attr($, 'meta[property="og:image"]', "content");
  const amount =
    attr($, 'meta[property="product:price:amount"]', "content") ??
    attr($, 'meta[itemprop="price"]', "content");
  const currency =
    attr($, 'meta[property="product:price:currency"]', "content") ??
    attr($, 'meta[itemprop="priceCurrency"]', "content");
  const priceValue = amount ? Number(amount.replaceAll(",", "")) : undefined;

  if (priceValue && Number.isFinite(priceValue) && currency) {
    return {
      title,
      imageUrl,
      priceText: `${currency.toUpperCase()} ${priceValue.toFixed(priceValue % 1 === 0 ? 0 : 2)}`,
      currency: currency.toUpperCase(),
      priceValue,
      isPurchasable: true
    };
  }

  const fallbackPrice = extractPrice($.root().text().slice(0, 4000));

  return {
    title,
    imageUrl,
    priceText: fallbackPrice?.priceText,
    currency: fallbackPrice?.currency,
    priceValue: fallbackPrice?.priceValue,
    isPurchasable: Boolean(fallbackPrice)
  };
}

function flattenJsonLd(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const graph = record["@graph"];

  return [record, ...flattenJsonLd(graph)];
}

function isProductLike(value: Record<string, unknown>): boolean {
  const type = value["@type"];
  if (Array.isArray(type)) return type.some((item) => String(item).toLowerCase() === "product");
  return String(type).toLowerCase() === "product";
}

function firstOffer(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return firstOffer(value[0]);
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return undefined;
}

function isOfficialSource(
  identification: ProductIdentification,
  candidate: ProductCandidate
): boolean {
  const source = candidate.source.toLowerCase();
  const terms = [
    identification.likelyProductName,
    ...identification.possibleBrands,
    ...identification.searchKeywords
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 3);

  return terms.some((term) => source.includes(term.replace(/s$/, "")));
}

function attr($: cheerio.CheerioAPI, selector: string, name: string): string | undefined {
  return cleanText($(selector).first().attr(name));
}

function cleanText(value?: string): string | undefined {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberFromUnknown(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(number) ? number : undefined;
}

function imageFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageFromUnknown(value[0]);
  if (value && typeof value === "object") {
    return stringFromUnknown((value as Record<string, unknown>).url);
  }
  return undefined;
}
