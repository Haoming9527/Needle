import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "../config.js";
import { getOpenAI } from "../lib/openai.js";
import { parseJsonWithSchema } from "../lib/json.js";
import { withTimeout } from "../lib/timeout.js";
import { extractFirstUrl } from "../lib/url.js";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  ProductIdentificationSchema,
  type ProductIdentification
} from "../types/needle.js";
import { PRODUCT_IDENTIFICATION_SYSTEM_PROMPT } from "./prompts.js";

const StructuredProductIdentificationSchema = z.object({
  inputType: z.enum(["image", "text", "url"]),
  productCategory: z.string(),
  likelyProductName: z.string(),
  possibleBrands: z.array(z.string()),
  visualAttributes: z.object({
    color: z.string().nullable(),
    material: z.string().nullable(),
    shape: z.string().nullable(),
    size: z.string().nullable(),
    distinctiveFeatures: z.array(z.string())
  }),
  useCase: z.string(),
  searchKeywords: z.array(z.string()),
  marketplaceKeywords: z.object({
    shopee: z.array(z.string()),
    lazada: z.array(z.string()),
    taobao: z.array(z.string()),
    google: z.array(z.string())
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  clarifyingQuestion: z.string().nullable()
});

type StructuredProductIdentification = z.infer<typeof StructuredProductIdentificationSchema>;

export type IdentifyProductInput = {
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  url?: string;
};

export async function identifyProduct(input: IdentifyProductInput): Promise<ProductIdentification> {
  const content: ResponseInputContent[] = [];
  const url = input.url ?? extractFirstUrl(input.text);

  if (input.text) {
    content.push({
      type: "input_text",
      text: `User text/caption: ${input.text}`
    });
  }

  if (url) {
    content.push({
      type: "input_text",
      text: `Product or listing URL: ${url}`
    });
  }

  if (input.imageBase64) {
    content.push({
      type: "input_image",
      detail: "auto",
      image_url: `data:${input.imageMimeType || "image/jpeg"};base64,${input.imageBase64}`
    });
  }

  if (content.length === 0) {
    return fallbackIdentification(input, "What item should Needle look for?");
  }

  const response = await withTimeout(
    getOpenAI().responses.create({
      model: env.OPENAI_MODEL,
      stream: false,
      text: {
        format: zodTextFormat(
          StructuredProductIdentificationSchema,
          "needle_product_identification"
        )
      },
      input: [
        {
          role: "system",
          content: PRODUCT_IDENTIFICATION_SYSTEM_PROMPT
        },
        {
          role: "user",
          content
        }
      ]
    }),
    input.imageBase64 ? 30_000 : 15_000,
    "OpenAI product identification"
  );

  try {
    return normalizeStructuredIdentification(
      parseJsonWithSchema(response.output_text, StructuredProductIdentificationSchema)
    );
  } catch {
    return parseJsonWithSchema(response.output_text, ProductIdentificationSchema);
  }
}

export function fallbackIdentification(
  input: IdentifyProductInput,
  clarifyingQuestion = "What is this item used for?"
): ProductIdentification {
  const url = input.url ?? extractFirstUrl(input.text);
  const textWithoutUrl = url && input.text ? input.text.replace(url, "") : input.text;
  const cleanText = normalizeFallbackText(textWithoutUrl);
  const likelyProductName = cleanText || (url ? "product from listing URL" : "unknown product");
  const keyword = likelyProductName === "unknown product" ? "product finder" : likelyProductName;

  return {
    inputType: input.imageBase64 ? "image" : url ? "url" : "text",
    productCategory: "unknown product",
    likelyProductName,
    possibleBrands: [],
    visualAttributes: {
      distinctiveFeatures: []
    },
    useCase: "finding matching product listings online",
    searchKeywords: [keyword],
    marketplaceKeywords: {
      shopee: [keyword],
      lazada: [keyword],
      taobao: [keyword],
      google: [keyword]
    },
    confidence: cleanText ? 0.45 : 0.3,
    reasoning:
      "Needle could not run product identification, so it fell back to the user's description.",
    clarifyingQuestion
  };
}

function normalizeFallbackText(text?: string): string | undefined {
  const cleaned = text
    ?.trim()
    .replace(/^(please\s+)?(help me\s+)?(find|search for|look for)\s+/i, "")
    .replace(/^(this|a|an|the)\s+/i, "")
    .trim();

  return cleaned || undefined;
}

function normalizeStructuredIdentification(
  value: StructuredProductIdentification
): ProductIdentification {
  return ProductIdentificationSchema.parse({
    ...value,
    visualAttributes: {
      color: value.visualAttributes.color ?? undefined,
      material: value.visualAttributes.material ?? undefined,
      shape: value.visualAttributes.shape ?? undefined,
      size: value.visualAttributes.size ?? undefined,
      distinctiveFeatures: value.visualAttributes.distinctiveFeatures
    },
    clarifyingQuestion: value.clarifyingQuestion ?? undefined
  });
}
