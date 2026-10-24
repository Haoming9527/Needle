import type { Interpretation, Offer, Preferences, Selection } from '../shared/types.js';

export interface ProviderResult { offers: Offer[]; warnings: string[] }
export interface ProductProvider {
  identify(selection: Selection, signal: AbortSignal): Promise<Interpretation>;
  search(item: Interpretation, preferences: Preferences, signal: AbortSignal, instruction?: string): Promise<ProviderResult>;
}
