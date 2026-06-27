import type {
  ProductIdentification,
  RankedProductCandidate
} from "../types/needle.js";

export function shouldAskClarifyingQuestion(
  identification: ProductIdentification,
  candidates: RankedProductCandidate[]
): boolean {
  const bestMatchConfidence = candidates[0]?.matchConfidence ?? 0;
  return identification.confidence < 0.55 || (bestMatchConfidence < 0.55 && candidates.length < 2);
}

export function getClarifyingQuestion(identification: ProductIdentification): string {
  return (
    identification.clarifyingQuestion ??
    `Is this mainly a ${identification.productCategory}, or is it used for something else?`
  );
}
