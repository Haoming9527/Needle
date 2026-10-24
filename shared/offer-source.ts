import type { Offer } from './types';

/** Describe the source website without inferring a marketplace seller. */
export function offerSource(offer: Pick<Offer, 'referenceUrl' | 'sourceUrl' | 'dataOrigin'>): { label: string; url: string | null } {
  for (const value of [offer.referenceUrl, offer.sourceUrl]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) continue;
      return { label: url.hostname.replace(/^www\./, ''), url: url.href };
    } catch { /* Old or incomplete records can have no usable source. */ }
  }
  return { label: offer.dataOrigin === 'sample' ? 'Needle catalog' : 'Source unavailable', url: null };
}
