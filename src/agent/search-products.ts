import { getExa } from "../lib/exa.js";
import { logger } from "../lib/logger.js";
import { withTimeout } from "../lib/timeout.js";
import { canonicalizeUrl, detectMarketplace, getDomain } from "../lib/url.js";
import { extractPrice } from "../lib/currency.js";
import type { ProductCandidate, ProductIdentification } from "../types/needle.js";
import { enrichCandidatesWithPageData } from "./enrich-products.js";

type ExaResult = {
  title?: string;
  url?: string;
  text?: string;
  summary?: string;
  image?: string;
  highlights?: string[];
};

export function buildSearchQueries(identification: ProductIdentification): string[] {
  const productName = identification.likelyProductName;
  const attributes = [
    identification.visualAttributes.color,
    identification.visualAttributes.material,
    identification.visualAttributes.shape,
    identification.useCase,
    ...identification.visualAttributes.distinctiveFeatures
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);

  const keywords = [
    productName,
    ...identification.searchKeywords,
    ...identification.marketplaceKeywords.shopee,
    ...identification.marketplaceKeywords.lazada,
    ...identification.marketplaceKeywords.google
  ]
    .map((keyword) => keyword.trim())
    .filter(Boolean);

  const primary = keywords[0] || productName;
  const secondary = keywords[1] || identification.productCategory;
  const attributeQuery = attributes.slice(0, 3).join(" ");
  const compactQuery = uniqueStrings([primary, secondary, attributeQuery])
    .filter((part) => part.length > 2)
    .join(" ");

  return uniqueStrings([
    compactQuery,
    `${primary} buy Singapore price`,
    `${primary} Shopee Singapore`,
    `${primary} Lazada Singapore`,
    `${primary} Taobao`,
    `${primary} Carousell Singapore`,
    `${primary} AliExpress`,
    `${primary} ${secondary} price`,
    `site:shopee.sg ${primary}`,
    `site:lazada.sg ${primary}`,
    `site:amazon.sg ${primary}`,
    `site:carousell.sg ${primary}`,
    attributeQuery ? `${primary} ${attributeQuery} Singapore` : "",
    ...keywords.slice(0, 4).map((keyword) => `${keyword} Singapore online`)
  ]).slice(0, 10);
}

export async function searchProducts(
  identification: ProductIdentification
): Promise<ProductCandidate[]> {
  const queries = buildSearchQueries(identification).slice(0, 8);
  const exa = getExa();

  if (queries.length === 0) {
    return [];
  }

  const searchPromises = queries.map(async (query) => {
    const result = await withTimeout(
      exa.searchAndContents(query, {
        numResults: 5,
        text: {
          maxCharacters: 800
        }
      }),
      15_000,
      `Exa search for "${query}"`
    );

    return (result.results ?? []) as ExaResult[];
  });

  const settled = await Promise.allSettled(searchPromises);
  const results = settled.flatMap((entry, index) => {
    if (entry.status === "rejected") {
      logger.warn({ error: entry.reason, query: queries[index] }, "Exa query failed");
      return [];
    }

    return entry.value;
  });

  const candidates = await enrichCandidatesWithPageData(
    identification,
    dedupeAndNormalize(results).slice(0, 20)
  );

  logger.info(
    {
      queryCount: queries.length,
      rawResultCount: results.length,
      candidateCount: candidates.length
    },
    "Exa product search completed"
  );

  return candidates;
}

function dedupeAndNormalize(results: ExaResult[]): ProductCandidate[] {
  const seen = new Set<string>();
  const candidates: ProductCandidate[] = [];

  for (const result of results) {
    if (!result.url || !result.title) continue;

    const canonicalUrl = canonicalizeUrl(result.url);
    const dedupeKey = canonicalUrl.toLowerCase();

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const snippet = result.summary ?? result.text ?? result.highlights?.join(" ");
    const price = extractPrice(`${result.title} ${snippet ?? ""}`);

    candidates.push({
      title: result.title,
      url: canonicalUrl,
      source: getDomain(canonicalUrl),
      snippet,
      imageUrl: result.image,
      priceText: price?.priceText,
      currency: price?.currency,
      priceValue: price?.priceValue,
      marketplace: detectMarketplace(canonicalUrl),
      isPurchasable: Boolean(price)
    });
  }

  return candidates;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
