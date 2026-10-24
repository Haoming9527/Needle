import type { Interpretation, Preferences } from './types';

export function searchRecoveryQuestion(item: Interpretation, preferences: Preferences = {}): string {
  if (preferences.budget !== undefined && preferences.currency) {
    return `No matching ${item.productType.trim() || 'item'} was found within ${preferences.currency} ${preferences.budget.toLocaleString('en-US')}. What budget or brand/model should I try?`;
  }
  return `For ${item.productType.trim() || 'this item'}, do you want a specific brand/model or something similar?`;
}
