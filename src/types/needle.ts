import { z } from "zod";

export const ProductIdentificationSchema = z.object({
  inputType: z.enum(["image", "text", "url"]).default("text"),
  productCategory: z.string().default("unknown product"),
  likelyProductName: z.string().default("unknown product"),
  possibleBrands: z.array(z.string()).default([]),
  visualAttributes: z
    .object({
      color: z.string().optional(),
      material: z.string().optional(),
      shape: z.string().optional(),
      size: z.string().optional(),
      distinctiveFeatures: z.array(z.string()).default([])
    })
    .default({ distinctiveFeatures: [] }),
  useCase: z.string().default("finding where to buy the item"),
  searchKeywords: z.array(z.string()).default([]),
  marketplaceKeywords: z
    .object({
      shopee: z.array(z.string()).default([]),
      lazada: z.array(z.string()).default([]),
      taobao: z.array(z.string()).default([]),
      google: z.array(z.string()).default([])
    })
    .default({
      shopee: [],
      lazada: [],
      taobao: [],
      google: []
    }),
  confidence: z.coerce.number().min(0).max(1).default(0.3),
  reasoning: z.string().default("Needle could not confidently identify this item."),
  clarifyingQuestion: z.string().nullable().optional()
});

export type ProductIdentification = z.infer<typeof ProductIdentificationSchema>;

export const ProductCandidateSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  snippet: z.string().optional(),
  imageUrl: z.string().optional(),
  priceText: z.string().optional(),
  currency: z.string().optional(),
  priceValue: z.number().optional(),
  marketplace: z.string().optional(),
  isOfficialSource: z.boolean().optional(),
  isPurchasable: z.boolean().optional()
});

export type ProductCandidate = z.infer<typeof ProductCandidateSchema>;

export const RankedProductCandidateSchema = ProductCandidateSchema.extend({
  matchConfidence: z.coerce.number().min(0).max(1).default(0.45),
  matchReasons: z.array(z.string()).default([]),
  mismatchReasons: z.array(z.string()).default([]),
  buyingRisk: z.enum(["low", "medium", "high"]).default("medium"),
  riskReasons: z.array(z.string()).default([])
});

export type RankedProductCandidate = z.infer<typeof RankedProductCandidateSchema>;

export const PriceInsightSchema = z.object({
  observedMin: z.number().optional(),
  observedMax: z.number().optional(),
  typicalRangeText: z.string(),
  overpricedThresholdText: z.string(),
  notes: z.array(z.string()).default([])
});

export type PriceInsight = z.infer<typeof PriceInsightSchema>;

export const NeedleReportSchema = z.object({
  identification: ProductIdentificationSchema,
  candidates: z.array(RankedProductCandidateSchema).default([]),
  priceInsight: PriceInsightSchema,
  finalAdvice: z.string(),
  suggestedSearchLinks: z.array(
    z.object({
      label: z.string(),
      url: z.string()
    })
  ),
  needsClarification: z.boolean().default(false),
  clarifyingQuestion: z.string().nullable().optional()
});

export type NeedleReport = z.infer<typeof NeedleReportSchema>;
