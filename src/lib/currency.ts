export type ExtractedPrice = {
  priceText: string;
  currency: string;
  priceValue: number;
};

const PRICE_PATTERNS = [
  /\b(S\$|SGD)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  /\b(USD)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  /\b(RM)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  /\b(CN¥|CNY|¥)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
  /(^|[\s(])(\$)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/
];

export function extractPrice(text: string): ExtractedPrice | undefined {
  for (const pattern of PRICE_PATTERNS) {
    const match = text.match(pattern);

    if (!match) continue;

    const currency = match[2] === "$" ? "$" : match[1];
    const valueText = match[2] === "$" ? match[3] : match[2];
    const priceValue = Number(valueText.replaceAll(",", ""));

    if (Number.isFinite(priceValue)) {
      return {
        priceText: `${currency} ${priceValue.toFixed(priceValue % 1 === 0 ? 0 : 2)}`,
        currency: currency.toUpperCase(),
        priceValue
      };
    }
  }

  return undefined;
}

export function formatSgd(value: number): string {
  return `S$${value.toFixed(value % 1 === 0 ? 0 : 2)}`;
}

export function isSgdCurrency(currency?: string): boolean {
  const normalized = currency?.toUpperCase();
  return normalized === "S$" || normalized === "SGD";
}
