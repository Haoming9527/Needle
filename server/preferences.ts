import type { Preferences } from '../shared/types.js';
import { ApiError } from './errors.js';

const currencyCodes = new Set(Intl.supportedValuesOf('currency'));

/** The demo supports budget refinements without ever treating unlike currencies as comparable. */
export function budgetFromInstruction(instruction: string, existing: Preferences = {}, explicit: Preferences = {}): Preferences {
  const text = instruction.toUpperCase();
  const codeMatch = [...text.matchAll(/(?:^|[^A-Z])([A-Z]{3})(?=\s|\d|$)/g)].find(match => currencyCodes.has(match[1]));
  let currency = explicit.currency ?? codeMatch?.[1];
  if (!currency) {
    if (/₩|원/.test(text)) currency = 'KRW';
    else if (/US\$/.test(text)) currency = 'USD';
    else if (/S\$|SG\$/.test(text)) currency = 'SGD';
    else if (/NT\$/.test(text)) currency = 'TWD';
    else if (/€/.test(text)) currency = 'EUR';
    else if (/£/.test(text)) currency = 'GBP';
  }
  let amount: number | undefined = explicit.budget;
  if (amount === undefined && /\b(?:UNDER|BELOW|BUDGET|LESS THAN|MAX(?:IMUM)?|UP TO)\b|이하|미만/.test(text)) {
    const found = text.match(/(?:UNDER|BELOW|BUDGET|LESS THAN|MAX(?:IMUM)?|UP TO)\s*(?:(?:OF|TO)\s*)?(?:(?:[A-Z]{3}|US\$|S\$|NT\$|[$₩€£])\s*)?(\d[\d,]*(?:\.\d+)?)\s*([KM])?(?![A-Z0-9])/)
      ?? text.match(/(\d[\d,]*(?:\.\d+)?)\s*([KM])?\s*원?\s*(?:이하|미만)/);
    if (found) amount = Number(found[1].replace(/,/g, '')) * (found[2] === 'K' ? 1000 : found[2] === 'M' ? 1_000_000 : 1);
    else if (/\d/.test(text)) throw new ApiError(422, 'BUDGET_FORMAT', 'Use a clear budget such as “under KRW 50,000” or “under KRW 50k”.');
  }
  if (amount !== undefined && (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000)) throw new ApiError(422, 'BUDGET_FORMAT', 'Enter a budget between 0 and 1,000,000,000 in the stated currency.');
  if (amount !== undefined && !currency && (!existing.currency || /\$/.test(text))) throw new ApiError(422, 'CURRENCY_REQUIRED', 'Add a currency to your budget, for example “under KRW 50,000” or “under USD 50”.');
  if (currency && existing.currency && currency !== existing.currency && existing.budget !== undefined && amount === undefined) throw new ApiError(422, 'CURRENCY_BUDGET_REQUIRED', 'Specify a new budget when changing currencies, for example “under USD 50”. The previous budget is not converted.');
  return { ...existing, ...explicit, ...(currency ? { currency } : {}), ...(amount !== undefined ? { budget: amount } : {}) };
}
