import { fallbackIdentification, identifyProduct } from "./identify-product.js";
import { searchProducts } from "./search-products.js";
import { rankProducts, ruleBasedRankProducts } from "./rank-products.js";
import { generatePriceInsight } from "./price-intelligence.js";
import { buildFinalAdvice } from "./risk-check.js";
import {
  getClarifyingQuestion,
  shouldAskClarifyingQuestion
} from "./clarifying-question.js";
import { saveSearch } from "../db/database.js";
import { env } from "../config.js";
import { logger } from "../lib/logger.js";
import {
  extractFirstUrl,
  googleSearchUrl,
  lazadaSearchUrl,
  shopeeSearchUrl,
  taobaoSearchUrl
} from "../lib/url.js";
import type { NeedleReport, ProductIdentification } from "../types/needle.js";
import type { ProductCandidate, RankedProductCandidate } from "../types/needle.js";

export type RunNeedleAgentInput = {
  telegramId: number;
  username?: string;
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  url?: string;
  imageFileId?: string;
};

export async function runNeedleAgent(input: RunNeedleAgentInput): Promise<NeedleReport> {
  const url = input.url ?? extractFirstUrl(input.text);
  let identification: ProductIdentification;

  try {
    identification = await identifyProduct({ ...input, url });
  } catch (error) {
    logger.warn(
      { error: serializeError(error) },
      "Product identification failed; using fallback identification"
    );
    identification = fallbackIdentification({ ...input, url });
  }

  let candidates: ProductCandidate[] = [];

  try {
    candidates = await searchProducts(identification);
  } catch (error) {
    logger.warn({ error: serializeError(error) }, "Live product search failed");
  }

  let rankedCandidates: RankedProductCandidate[] = ruleBasedRankProducts(identification, candidates);

  if (env.ENABLE_MODEL_RERANK && candidates.length > 0) {
    try {
      const modelRankedCandidates = await rankProducts(identification, candidates);
      rankedCandidates = mergeRankings(rankedCandidates, modelRankedCandidates);
    } catch (error) {
      logger.warn({ error: serializeError(error) }, "Model rerank failed; using Needle's local scoring");
    }
  } else if (candidates.length > 0) {
    logger.debug("Model rerank skipped; using Needle's local scoring");
  }

  logger.info(
    {
      candidateCount: candidates.length,
      rankedCandidateCount: rankedCandidates.length
    },
    "Needle candidate ranking completed"
  );

  const priceInsight = generatePriceInsight(rankedCandidates);
  const needsClarification = shouldAskClarifyingQuestion(identification, rankedCandidates);
  const clarifyingQuestion = needsClarification ? getClarifyingQuestion(identification) : undefined;

  const report: NeedleReport = {
    identification,
    candidates: rankedCandidates.slice(0, 3),
    priceInsight,
    finalAdvice: buildFinalAdvice(identification, rankedCandidates),
    suggestedSearchLinks: buildSuggestedSearchLinks(identification),
    needsClarification,
    clarifyingQuestion
  };

  try {
    saveSearch(input, report);
  } catch (error) {
    logger.warn({ error: serializeError(error) }, "Failed to save search history");
  }

  return report;
}

function buildSuggestedSearchLinks(identification: ProductIdentification) {
  const primary =
    identification.searchKeywords[0] ||
    identification.marketplaceKeywords.google[0] ||
    identification.likelyProductName;

  return [
    {
      label: "Shopee",
      url: shopeeSearchUrl(identification.marketplaceKeywords.shopee[0] ?? primary)
    },
    {
      label: "Lazada",
      url: lazadaSearchUrl(identification.marketplaceKeywords.lazada[0] ?? primary)
    },
    {
      label: "Taobao",
      url: taobaoSearchUrl(identification.marketplaceKeywords.taobao[0] ?? primary)
    },
    {
      label: "Google",
      url: googleSearchUrl(identification.marketplaceKeywords.google[0] ?? primary)
    }
  ];
}

function mergeRankings(
  localCandidates: RankedProductCandidate[],
  modelCandidates: RankedProductCandidate[]
): RankedProductCandidate[] {
  if (modelCandidates.length === 0) {
    return localCandidates;
  }

  const localByUrl = new Map(localCandidates.map((candidate) => [candidate.url, candidate]));

  return modelCandidates
    .map((modelCandidate) => {
      const localCandidate = localByUrl.get(modelCandidate.url);

      if (!localCandidate) {
        return modelCandidate;
      }

      return {
        ...modelCandidate,
        matchConfidence: Math.max(
          localCandidate.matchConfidence,
          modelCandidate.matchConfidence * 0.75 + localCandidate.matchConfidence * 0.25
        ),
        matchReasons: uniqueStrings([
          ...localCandidate.matchReasons,
          ...modelCandidate.matchReasons
        ]).slice(0, 4),
        mismatchReasons: uniqueStrings([
          ...localCandidate.mismatchReasons,
          ...modelCandidate.mismatchReasons
        ]).slice(0, 3),
        riskReasons: uniqueStrings([
          ...localCandidate.riskReasons,
          ...modelCandidate.riskReasons
        ]).slice(0, 4)
      } satisfies RankedProductCandidate;
    })
    .sort((a, b) => b.matchConfidence - a.matchConfidence)
    .slice(0, 5);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { value: error };
  }

  const richError = error as Error & {
    status?: number;
    code?: string;
    type?: string;
    param?: string;
    requestID?: string;
  };

  return {
    name: richError.name,
    message: richError.message,
    status: richError.status,
    code: richError.code,
    type: richError.type,
    param: richError.param,
    requestID: richError.requestID
  };
}
