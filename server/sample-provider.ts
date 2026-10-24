import type { Interpretation, Offer, Preferences, Selection } from '../shared/types.js';
import { sampleCatalog, SAMPLE_NOTICE, type SampleProduct } from './catalog.js';
import { ApiError } from './errors.js';
import { hasIdentifier, matchesModel, normalize } from './evidence.js';
import type { ProductProvider, ProviderResult } from './provider.js';

const stopWords = new Set(['a', 'an', 'the', 'find', 'this', 'that', 'with', 'for', 'on', 'me', 'some', 'something', 'similar', 'same', 'please', 'of', 'to', 'and']);
function tokens(value: string): string[] { return normalize(value).split(' ').filter(token => token.length > 1 && !stopWords.has(token)); }
function relevance(product: SampleProduct, text: string, category = ''): number {
  const categoryWords = new Set(tokens(category));
  const words = [...new Set(tokens(text))];
  const title = new Set(tokens(product.title));
  const description = new Set(tokens([...product.tags, ...product.attributes, product.color].join(' ')));
  // Category membership is scored separately. A title saying "laptop" must not
  // outrank a MacBook merely because its category is stored in tags instead.
  return words.reduce((score, word) => score + (categoryWords.has(word) ? 0 : title.has(word) ? 4 : description.has(word) ? 1 : 0), 0)
    + (hasIdentifier(text, product.model) ? 12 : 0);
}

export class SampleProvider implements ProductProvider {
  constructor(private readCatalog: () => SampleProduct[] = () => sampleCatalog) {}
  async identify(selection: Selection): Promise<Interpretation> {
    const text = selection.text?.trim() || '';
    if (!text) throw new ApiError(422, 'IMAGE_DESCRIPTION_REQUIRED', 'Add OPENAI_API_KEY to .env for automatic image recognition, or describe the selected object.');
    const best = [...this.readCatalog()].sort((a, b) => relevance(b, text) - relevance(a, text))[0];
    // A shared color or generic attribute is not enough to identify an unrelated item.
    const matched = best && relevance(best, text) >= 4;
    return {
      name: text,
      productType: matched ? best.productType : 'item',
      brand: matched && hasIdentifier(text, best.brand) ? best.brand : null,
      model: matched && matchesModel(text, best.model) ? best.model : null,
      color: matched && best.color && normalize(text).includes(normalize(best.color)) ? best.color : null,
      attributes: [],
      queries: [text],
      needsClarification: false,
      clarification: null,
      identifierEvidence: 'text',
    };
  }

  async search(item: Interpretation, preferences: Preferences, _signal?: AbortSignal, instruction = ''): Promise<ProviderResult> {
    return this.findOffers(item, preferences, instruction, false);
  }

  /** Keep a wider catalog pool until Decisions sees the actual selected crop. */
  async searchCandidates(item: Interpretation, preferences: Preferences, _signal?: AbortSignal, instruction = ''): Promise<ProviderResult> {
    return this.findOffers(item, preferences, instruction, true);
  }

  private findOffers(item: Interpretation, preferences: Preferences, instruction: string, candidates: boolean): ProviderResult {
    const target = [item.name, item.productType, item.brand, item.model, ...item.attributes].filter(Boolean).join(' ');
    const catalog = this.readCatalog();
    // Vision may say "backpack" while catalog records use "bag". Resolve that vocabulary
    // from the records themselves, without category-specific search branches.
    const knownType = catalog.find(product => normalize(product.productType) === normalize(item.productType))?.productType;
    const nearest = [...catalog].sort((a, b) => relevance(b, target) - relevance(a, target))[0];
    const productType = knownType ?? (nearest && relevance(nearest, target) >= 4 ? nearest.productType : item.productType);
    const ranked = catalog.map(product => ({ product,
      score: relevance(product, target, productType) + (productType !== 'item' && normalize(product.productType) === normalize(productType) ? 4 : 0),
      identity: (item.brand && hasIdentifier(`${product.brand} ${product.title}`, item.brand) ? 1 : 0)
        + (item.model && matchesModel(`${product.model} ${product.title}`, item.model) ? 2 : 0),
    }))
      .filter(({ product, score }) => score >= 4 && (productType === 'item' || normalize(product.productType) === normalize(productType)))
      .filter(({ product }) => preferences.budget === undefined || (product.currency === preferences.currency && product.price !== null && product.price <= preferences.budget));
    ranked.sort((a, b) => {
      if (a.identity !== b.identity) return b.identity - a.identity;
      if (/cheaper|lowest|affordable|budget/i.test(instruction) && a.product.currency === b.product.currency && a.product.price !== null && b.product.price !== null) return a.product.price - b.product.price;
      return b.score - a.score || relevance(b.product, instruction) - relevance(a.product, instruction);
    });
    // Keep the strongest matches plus prepared records in a bounded pool. Cached
    // web descriptions must not crowd all prepared products out of comparison.
    const pool = candidates
      ? [...ranked.slice(0, 4), ...ranked.filter(({ product }) => !product.referenceUrl), ...ranked]
      : ranked;
    const seen = new Set<string>();
    const selected = pool.filter(({ product }) => { if (seen.has(product.id)) return false; seen.add(product.id); return true; }).slice(0, candidates ? 8 : 3);
    const offers: Offer[] = selected.map(({ product }, index) => {
      const sameModel = !!item.model && !!item.brand && matchesModel(product.title, item.model) && hasIdentifier(product.title, item.brand);
      const exact = sameModel && item.identifierEvidence === 'text';
      const differences = exact ? [] : item.model && product.model ? [`Different model: ${product.model}.`] : ['Exact identity is unverified. Compare the design and features.'];
      return {
        id: product.id,
        title: product.title,
        description: product.attributes.join(' · '),
        imageUrl: product.imageUrl || null,
        sourceUrl: null,
        ...(product.referenceUrl ? { referenceUrl: product.referenceUrl } : {}),
        ...(product.priceIsIllustrative !== undefined ? { priceIsIllustrative: product.priceIsIllustrative } : {}),
        match: exact ? 'exact' : sameModel ? 'likely' : 'similar',
        matchEvidence: exact ? `Your description names ${product.brand} ${product.model}, matching this sample record. This does not verify a current retailer listing.` : 'A related item from the sample catalog. Exact identity has not been verified.',
        price: product.price,
        currency: product.currency,
        observedAt: product.observedAt ?? '2026-10-25T00:00:00.000Z',
        dataOrigin: 'sample',
        variants: product.variants,
        shipping: null,
        availability: null,
        returns: null,
        reason: exact ? 'The model you named appears in the sample catalog.' : index === 0 ? `An option that fits your description${preferences.budget !== undefined ? ' and stated budget' : ''}.` : product.attributes[0] ? `Another option to compare, featuring ${product.attributes[0].toLowerCase()}.` : 'Another option to compare with your selection.',
        differences,
      };
    });
    return { offers, warnings: [SAMPLE_NOTICE, 'Catalog matching uses your description. Add an API key to enable automatic image recognition.', ...(offers.length ? [] : ['No sample items match this description and budget. Try a microphone, laptop, headphones, backpack, or desk lamp.']), ...(preferences.budget !== undefined ? ['Budget filtering includes only offers in the stated currency. No currency conversion is performed.'] : [])] };
  }
}
