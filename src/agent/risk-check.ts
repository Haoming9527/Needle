import type {
  ProductIdentification,
  RankedProductCandidate
} from "../types/needle.js";

export function collectRiskNotes(candidates: RankedProductCandidate[]): string[] {
  const notes = candidates.flatMap((candidate) => candidate.riskReasons);
  const unique = [...new Set(notes.map((note) => note.trim()).filter(Boolean))];

  if (unique.length > 0) {
    return unique.slice(0, 3);
  }

  return [
    "Needle cannot verify authenticity from search snippets alone.",
    "Check seller rating, reviews, shipping fee, and return policy before buying."
  ];
}

export function buildFinalAdvice(
  identification: ProductIdentification,
  candidates: RankedProductCandidate[]
): string {
  const top = candidates[0];

  if (!top) {
    return "I could identify a likely search direction, but live matches were weak. Use the suggested marketplace links and add a clearer product photo or use-case if needed.";
  }

  if (identification.confidence < 0.55) {
    return "I found possible matches, but confidence is low. Answer the clarifying question or send a clearer photo before buying.";
  }

  if (top.buyingRisk === "high") {
    return "The top match has notable risk signals. Treat it as a lead, not a buying recommendation.";
  }

  return "Use the top matches as buying leads, then compare seller rating, shipping fee, variants, and return policy before checking out.";
}
