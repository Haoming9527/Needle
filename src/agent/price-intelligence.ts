import { formatSgd, isSgdCurrency } from "../lib/currency.js";
import type { PriceInsight, RankedProductCandidate } from "../types/needle.js";

export function generatePriceInsight(candidates: RankedProductCandidate[]): PriceInsight {
  const sgdPrices = candidates
    .filter((candidate) => {
      return isSgdCurrency(candidate.currency);
    })
    .map((candidate) => candidate.priceValue)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (sgdPrices.length === 0) {
    return {
      typicalRangeText: "No reliable price range was detected from the live results.",
      overpricedThresholdText:
        "Open the suggested searches and compare seller ratings, shipping, and returns before buying.",
      notes: ["Search snippets often hide shipping fees and variant pricing."]
    };
  }

  const observedMin = Math.min(...sgdPrices);
  const observedMax = Math.max(...sgdPrices);
  const threshold = observedMax * 1.5;

  return {
    observedMin,
    observedMax,
    typicalRangeText: `Observed range: ${formatSgd(observedMin)}-${formatSgd(observedMax)} from detected prices.`,
    overpricedThresholdText: `Be cautious above about ${formatSgd(threshold)} unless the item is branded, bundled, or has faster local shipping.`,
    notes: [
      "Detected prices are best-effort from listing titles and snippets.",
      "Always check final checkout price, shipping fee, and seller rating."
    ]
  };
}
