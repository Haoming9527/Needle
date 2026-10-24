import type { Interpretation, Offer, Preferences, Selection } from '../shared/types.js';
import { sampleCatalog, SAMPLE_NOTICE, type SampleProduct } from './catalog.js';
import { ApiError } from './errors.js';
import { hasIdentifier, matchesModel, normalize } from './evidence.js';
import type { ProductProvider, ProviderResult } from './provider.js';

const stopWords = new Set(['a', 'an', 'the', 'find', 'this', 'that', 'with', 'for', 'on', 'me', 'some', 'something', 'similar', 'same', 'please', 'coupang', 'of', 'to', 'and']);
function tokens(value: string): string[] { return normalize(value).split(' ').filter(token => token.length > 1 && !stopWords.has(token)); }
function relevance(product: SampleProduct, text: string): number {
  const words = tokens(text);
  const title = new Set(tokens(product.title));
  const description = new Set(tokens([...product.tags, ...product.attributes, product.color].join(' ')));
  return words.reduce((score, word) => score + (title.has(word) ? 4 : description.has(word) ? 1 : 0), 0)
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
    const target = [item.name, item.productType, ...item.attributes].join(' ');
    const catalog = this.readCatalog();
    // Vision may say "backpack" while catalog records use "bag". Resolve that vocabulary
    // from the records themselves, without category-specific search branches.
    const knownType = catalog.find(product => normalize(product.productType) === normalize(item.productType))?.productType;
    const nearest = [...catalog].sort((a, b) => relevance(b, target) - relevance(a, target))[0];
    const productType = knownType ?? (nearest && relevance(nearest, target) >= 4 ? nearest.productType : item.productType);
    const ranked = catalog.map(product => ({ product, score: relevance(product, target) + (productType !== 'item' && product.productType === productType ? 4 : 0) }))
      .filter(({ product, score }) => score >= 4 && (productType === 'item' || product.productType === productType))
      .filter(({ product }) => preferences.budget === undefined || (product.currency === preferences.currency && product.price !== null && product.price <= preferences.budget));
    ranked.sort((a, b) => {
      if (/cheaper|lowest|affordable|budget/i.test(instruction) && a.product.currency === b.product.currency && a.product.price !== null && b.product.price !== null) return a.product.price - b.product.price;
      return b.score - a.score || relevance(b.product, instruction) - relevance(a.product, instruction);
    });
    const offers: Offer[] = ranked.slice(0, 3).map(({ product }, index) => {
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
        matchEvidence: exact ? `Your description names ${product.brand} ${product.model}, matching this sample record. This does not verify a live Coupang listing.` : 'A related item from the sample catalog. Exact identity has not been verified.',
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
