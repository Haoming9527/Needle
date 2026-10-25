import type { DiscoveryMode, Interpretation, Offer, Preferences, SearchResponse, Selection } from '../../shared/types.js';
import { searchRecoveryQuestion } from '../../shared/search-recovery.js';
import { missingKeys, type ServerConfig } from '../config.js';
import { ApiError } from '../errors.js';
import type { ProductProvider, ProviderResult } from '../providers/types.js';
import { decideProducts } from './product-decision.js';

type SearchOutcome = ProviderResult
  & Pick<SearchResponse, 'discoverySource' | 'webSearch' | 'decision'>
  & { interpretation?: Interpretation };

interface DiscoveryDependencies {
  config: ServerConfig;
  providers: Record<DiscoveryMode, ProductProvider>;
  webProvider: Pick<ProductProvider, 'search'>;
  cacheWebOffers: (item: Interpretation, offers: Offer[]) => Offer[];
  decide?: typeof decideProducts;
}

/** Search the catalog or web, rank candidates, and recover from an exhausted search. */
export function createDiscoverySearch({
  config,
  providers,
  webProvider,
  cacheWebOffers,
  decide = decideProducts,
}: DiscoveryDependencies) {
  const liveMissing = missingKeys(config);

  return async function searchWithFallback(
    mode: DiscoveryMode,
    item: Interpretation,
    preferences: Preferences,
    signal: AbortSignal,
    instruction = '',
    selection?: Selection,
  ): Promise<SearchOutcome> {
    const finish = (result: SearchOutcome): SearchOutcome => {
      if (
        result.offers.length
        || item.needsClarification
        || result.interpretation?.needsClarification
        || result.webSearch?.status === 'failed'
        || result.webSearch?.status === 'unavailable'
      ) return result;

      const clarification = searchRecoveryQuestion(item, preferences);
      return {
        ...result,
        interpretation: { ...item, needsClarification: true, clarification },
        ...(result.decision?.status === 'no_match' && result.webSearch
          ? { webSearch: { ...result.webSearch, status: 'empty', message: clarification } }
          : {}),
      };
    };

    const rank = async (result: ProviderResult): Promise<SearchOutcome> => {
      if (item.needsClarification || !result.offers.length) return result;
      const ranked = await decide(config, { item, preferences, instruction, selection, offers: result.offers }, signal);
      return {
        ...ranked,
        offers: ranked.offers.slice(0, 3),
        warnings: [...result.warnings, ...ranked.warnings],
      };
    };

    const primary = await rank(await providers[mode].search(item, preferences, signal, instruction));
    if (mode === 'live') {
      if (
        !primary.offers.length
        && !item.needsClarification
        && primary.decision?.status === 'no_match'
        && item.productType.trim()
      ) {
        const retry = await rank(await providers.live.search(
          { ...item, queries: [item.productType.trim()] }, preferences, signal, instruction,
        ));
        return finish({ ...retry, discoverySource: 'exa' });
      }
      return finish({ ...primary, discoverySource: 'exa' });
    }
    if (primary.offers.length || item.needsClarification || primary.interpretation?.needsClarification) {
      return { ...primary, discoverySource: 'catalog' };
    }

    if (liveMissing.length) {
      const message = `No catalog match. Automatic web search needs ${liveMissing.join(' and ')} in .env. Add the missing key${liveMissing.length > 1 ? 's' : ''}, restart the server, and retry.`;
      return finish({
        ...primary,
        warnings: [...primary.warnings, message],
        discoverySource: 'catalog',
        webSearch: { status: 'unavailable', message },
      });
    }

    try {
      // Retrieval reuses the identified object; Decisions compares these candidates
      // against the original focused selection within the same request deadline.
      const searchWeb = async (target: Interpretation) => {
        const web = await webProvider.search(target, preferences, signal, instruction);
        const offers = cacheWebOffers(item, web.offers).filter(offer =>
          preferences.budget === undefined
          || (offer.currency === preferences.currency && offer.price !== null && offer.price <= preferences.budget),
        );
        return rank({ offers, warnings: [...primary.warnings, ...web.warnings] });
      };
      let ranked = await searchWeb(item);
      if (!ranked.offers.length && ranked.decision?.status === 'no_match' && item.productType.trim()) {
        // Broaden retrieval once, but Decisions still sees the original pointed
        // target, buyer constraints, and crop. Never force an unrelated winner.
        ranked = await searchWeb({ ...item, queries: [item.productType.trim()] });
      }
      const message = ranked.offers.length
        ? 'Found product references with Exa and added them to your demo catalog.'
        : 'Exa searched across stores but found no matching product references. Try a broader description or a brand/model name.';
      return finish({
        ...ranked,
        warnings: [...ranked.warnings, message],
        discoverySource: 'exa',
        webSearch: { status: ranked.offers.length ? 'used' : 'empty', message },
      });
    } catch (error) {
      if (signal.aborted) {
        throw new ApiError(504, 'TIMEOUT', 'This search took too long. Try again or narrow your description.');
      }
      const detail = error instanceof ApiError
        ? error.message
        : 'The web search service could not be reached. Please retry.';
      const message = `No catalog match. Automatic web search could not finish. ${detail}`;
      return finish({
        ...primary,
        warnings: [...primary.warnings, message],
        discoverySource: 'exa',
        webSearch: { status: 'failed', message },
      });
    }
  };
}
