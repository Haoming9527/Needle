import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../config.js";
import { getOpenAI } from "../lib/openai.js";
import { parseJsonWithSchema } from "../lib/json.js";
import { withTimeout } from "../lib/timeout.js";
import {
  RankedProductCandidateSchema,
  type ProductCandidate,
  type ProductIdentification,
  type RankedProductCandidate
} from "../types/needle.js";
import { MATCH_RANKING_SYSTEM_PROMPT } from "./prompts.js";

const RankingResponseSchema = z.object({
  rankedCandidates: z.array(RankedProductCandidateSchema).default([])
});

const StructuredRankedCandidateSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  snippet: z.string().nullable(),
  imageUrl: z.string().nullable(),
  priceText: z.string().nullable(),
  currency: z.string().nullable(),
  priceValue: z.number().nullable(),
  marketplace: z.string().nullable(),
  isOfficialSource: z.boolean(),
  isPurchasable: z.boolean(),
  matchConfidence: z.number().min(0).max(1),
  matchReasons: z.array(z.string()),
  mismatchReasons: z.array(z.string()),
  buyingRisk: z.enum(["low", "medium", "high"]),
  riskReasons: z.array(z.string())
});

const StructuredRankingResponseSchema = z.object({
  rankedCandidates: z.array(StructuredRankedCandidateSchema)
});

export async function rankProducts(
  identification: ProductIdentification,
  candidates: ProductCandidate[]
): Promise<RankedProductCandidate[]> {
  if (candidates.length === 0) {
    return [];
  }

  const response = await withTimeout(
    getOpenAI().responses.create({
      model: env.OPENAI_MODEL,
      stream: false,
      text: {
        format: zodTextFormat(StructuredRankingResponseSchema, "needle_candidate_ranking")
      },
      input: [
        {
          role: "system",
          content: MATCH_RANKING_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: JSON.stringify({
            identification,
            candidates: candidates.slice(0, 10).map((candidate) => ({
              ...candidate,
              snippet: candidate.snippet?.slice(0, 300)
            }))
          })
        }
      ]
    }),
    15_000,
    "OpenAI product ranking"
  );

  const parsed = normalizeStructuredRanking(
    parseJsonWithSchema(response.output_text, StructuredRankingResponseSchema)
  );

  return parsed.rankedCandidates
    .filter((candidate) => candidate.matchConfidence >= 0.45)
    .sort((a, b) => b.matchConfidence - a.matchConfidence)
    .slice(0, 5);
}

function normalizeStructuredRanking(
  value: z.infer<typeof StructuredRankingResponseSchema>
): z.infer<typeof RankingResponseSchema> {
  return RankingResponseSchema.parse({
    rankedCandidates: value.rankedCandidates.map((candidate) => ({
      ...candidate,
      snippet: candidate.snippet ?? undefined,
      imageUrl: candidate.imageUrl ?? undefined,
      priceText: candidate.priceText ?? undefined,
      currency: candidate.currency ?? undefined,
      priceValue: candidate.priceValue ?? undefined,
      marketplace: candidate.marketplace ?? undefined
    }))
  });
}

export function ruleBasedRankProducts(
  identification: ProductIdentification,
  candidates: ProductCandidate[]
): RankedProductCandidate[] {
  const fingerprint = buildProductFingerprint(identification);

  const scored = candidates
    .map((candidate) => {
      const haystack = `${candidate.title} ${candidate.snippet ?? ""}`.toLowerCase();
      const title = candidate.title.toLowerCase();
      const matches = fingerprint.terms.filter((term) => haystack.includes(term));
      const titleMatches = fingerprint.terms.filter((term) => title.includes(term));
      const marketplaceBoost = scoreMarketplace(candidate.marketplace);
      const priceBoost = candidate.priceText ? 0.06 : 0;
      const imageBoost = candidate.imageUrl ? 0.04 : 0;
      const officialBoost = candidate.isOfficialSource ? 0.08 : 0;
      const spamPenalty = candidate.isOfficialSource ? 0 : scoreSpamPenalty(haystack, candidate.source);
      const confidence = clamp(
        0.22 +
          matches.length * 0.045 +
          titleMatches.length * 0.055 +
          marketplaceBoost +
          priceBoost +
          imageBoost +
          officialBoost -
          spamPenalty,
        0.1,
        0.9
      );
      const buyingRisk = estimateBuyingRisk(candidate, confidence, spamPenalty);

      return {
        ...candidate,
        matchConfidence: confidence,
        matchReasons: buildMatchReasons(matches, titleMatches, candidate),
        mismatchReasons: buildMismatchReasons(candidate, spamPenalty),
        buyingRisk,
        riskReasons: buildRiskReasons(candidate, buyingRisk, spamPenalty)
      } satisfies RankedProductCandidate;
    })
    .sort((a, b) => b.matchConfidence - a.matchConfidence);

  const strongMatches = scored.filter((candidate) => candidate.matchConfidence >= 0.45);

  return (strongMatches.length > 0 ? strongMatches : scored).slice(0, 5);
}

function buildProductFingerprint(identification: ProductIdentification) {
  const rawTerms = [
    identification.likelyProductName,
    identification.productCategory,
    identification.useCase,
    identification.visualAttributes.color,
    identification.visualAttributes.material,
    identification.visualAttributes.shape,
    ...identification.visualAttributes.distinctiveFeatures,
    ...identification.searchKeywords,
    ...identification.marketplaceKeywords.shopee,
    ...identification.marketplaceKeywords.lazada,
    ...identification.marketplaceKeywords.google
  ];

  const terms = rawTerms
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3)
    .filter((term) => !STOP_WORDS.has(term));

  return {
    terms: [...new Set(terms)].slice(0, 40)
  };
}

function buildMatchReasons(
  matches: string[],
  titleMatches: string[],
  candidate: ProductCandidate
): string[] {
  const reasons: string[] = [];

  if (titleMatches.length > 0) {
    reasons.push(`Title matches product signals: ${titleMatches.slice(0, 5).join(", ")}`);
  } else if (matches.length > 0) {
    reasons.push(`Listing text matches product signals: ${matches.slice(0, 5).join(", ")}`);
  }

  if (candidate.marketplace && candidate.marketplace !== "Web") {
    reasons.push(`Found on ${candidate.marketplace}, which is useful for a buying lead.`);
  }

  if (candidate.isOfficialSource) {
    reasons.push("Official or brand-owned source, useful for verifying product identity.");
  }

  if (candidate.priceText) {
    reasons.push(`Visible price detected: ${candidate.priceText}.`);
  }

  return reasons.length > 0 ? reasons : ["Kept as a weak but possibly related buying lead."];
}

function buildMismatchReasons(candidate: ProductCandidate, spamPenalty: number): string[] {
  const reasons: string[] = [];

  if (!candidate.imageUrl) {
    reasons.push("No image was available in the search result to verify exact shape.");
  }

  if (!candidate.priceText && !candidate.isOfficialSource) {
    reasons.push("No reliable price was detected from the title or snippet.");
  }

  if (spamPenalty > 0) {
    reasons.push("Listing text has weak or noisy commerce signals.");
  }

  return reasons;
}

function buildRiskReasons(
  candidate: ProductCandidate,
  risk: RankedProductCandidate["buyingRisk"],
  spamPenalty: number
): string[] {
  const reasons: string[] = [];

  if (candidate.isOfficialSource) {
    reasons.push("Official source; useful for identity, but may not be a checkout listing.");
  } else if (candidate.marketplace === "Web") {
    reasons.push("Source is not a known marketplace, so inspect the seller and return policy.");
  }

  if (!candidate.priceText && !candidate.isOfficialSource) {
    reasons.push("No reliable price was visible from the search snippet.");
  }

  if (spamPenalty > 0) {
    reasons.push("Search snippet looks broad or SEO-heavy; verify the listing manually.");
  }

  if (risk === "low") {
    reasons.push(
      candidate.isOfficialSource
        ? "Brand-owned source lowers identity risk; use a priced seller listing for checkout."
        : "Known marketplace or clearer listing signals, but still compare seller rating and shipping."
    );
  }

  return reasons.slice(0, 3);
}

function scoreMarketplace(marketplace?: string): number {
  switch (marketplace) {
    case "Shopee":
    case "Lazada":
    case "Amazon":
    case "Carousell":
      return 0.12;
    case "Taobao":
    case "AliExpress":
      return 0.08;
    default:
      return 0;
  }
}

function scoreSpamPenalty(haystack: string, source: string): number {
  let penalty = 0;

  if (/(coupon|promo code|best deals|top 10|review roundup)/i.test(haystack)) {
    penalty += 0.08;
  }

  if (/(pinterest|facebook|instagram|tiktok|youtube)\./i.test(source)) {
    penalty += 0.08;
  }

  if (haystack.length < 80) {
    penalty += 0.04;
  }

  return penalty;
}

function estimateBuyingRisk(
  candidate: ProductCandidate,
  confidence: number,
  spamPenalty: number
): RankedProductCandidate["buyingRisk"] {
  if (candidate.isOfficialSource) {
    return "low";
  }

  if (spamPenalty >= 0.12 || (candidate.marketplace === "Web" && !candidate.priceText)) {
    return "high";
  }

  if (confidence < 0.6 || !candidate.priceText || candidate.marketplace === "Web") {
    return "medium";
  }

  return "low";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "find",
  "buy",
  "price",
  "online",
  "singapore",
  "product",
  "likely",
  "item"
]);
