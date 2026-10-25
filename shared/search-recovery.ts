import type { Interpretation, Preferences } from './types';

export function searchRecoveryQuestion(item: Interpretation, preferences: Preferences = {}): string {
  if (preferences.budget !== undefined && preferences.currency) {
    return `No matching ${item.productType.trim() || 'item'} was found within ${preferences.currency} ${preferences.budget.toLocaleString('en-US')}. What budget or brand/model should I try?`;
  }
  return `I could not find a suitable ${item.productType.trim() || 'item'}. What detail should I search for next?`;
}
