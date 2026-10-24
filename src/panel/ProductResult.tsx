import { Check, ChevronDown, ExternalLink, Plus, ShoppingBag } from 'lucide-react';
import type { Offer, SearchResponse } from '../../shared/types';
import { offerSource } from '../../shared/offer-source';
import { assetUrl, type CheckoutSelection } from './CheckoutDialog';
import { formatMoney, ProductImage } from './ui';

export const matchNames = { exact: 'Exact match', likely: 'Likely match', similar: 'Similar alternative' };

export function ProductResult({ response, offer, fallbackSrc, pending, onSelect, onCheckout }: { response: SearchResponse; offer: Offer; fallbackSrc?: string | null; pending: boolean; onSelect: (id: string) => void; onCheckout: (value: CheckoutSelection) => void }) {
  const source = offerSource(offer);
  return <>
    <article className="featured-offer">
      <ProductImage src={assetUrl(offer.imageUrl)} fallbackSrc={fallbackSrc} alt={offer.title} />
      <div className="offer-labels"><span className={`match-label match-${offer.match}`}>{offer.match === 'exact' && <Check size={12} />}{matchNames[offer.match]}</span><span className="origin-label">{source.label}</span></div>
      <h2>{offer.title}</h2><p className="price">{formatMoney(offer.price, offer.currency)}</p>{offer.dataOrigin === 'sample' && <p className="small-note">Illustrative terms · simulated checkout</p>}<p className="recommendation-reason">{offer.reason}</p>
      <div className="offer-actions"><button className="primary-button" onClick={() => onCheckout({ offer, sessionId: response.sessionId, action: 'buy', fallbackSrc })} disabled={pending}><ShoppingBag size={16} />Buy</button><button className="secondary-button" onClick={() => onCheckout({ offer, sessionId: response.sessionId, action: 'cart', fallbackSrc })} disabled={pending}><Plus size={16} />Add to cart</button></div>
      <details className="offer-evidence"><summary>Product details <ChevronDown size={14} /></summary><div><p>{offer.matchEvidence}</p>{offer.differences.length > 0 && <p>{offer.differences.join(' · ')}</p>}<dl><dt>Availability</dt><dd>{offer.availability ?? 'Unknown'}</dd><dt>Shipping</dt><dd>{offer.shipping ?? 'Unknown'}</dd><dt>Returns</dt><dd>{offer.returns ?? 'Unknown'}</dd></dl><p className="small-note">{offer.dataOrigin === 'sample' ? 'Illustrative catalog record' : 'Listing observed'} {new Date(offer.observedAt).toLocaleDateString('en-SG')}. {offer.dataOrigin === 'sample' ? 'Current stock is unverified.' : ''}</p>{offer.priceIsIllustrative && <p className="small-note">This price is assigned for the demo, not a quote from the original seller.</p>}{source.url && <a className="source-link" href={source.url} target="_blank" rel="noreferrer">{offer.referenceUrl ? 'Original product source' : 'View product'} <ExternalLink size={13} /></a>}</div></details>
    </article>
    {response.offers.length > 1 && <div className="alternatives"><h3>Other options</h3>{response.offers.filter(item => item.id !== offer.id).map(item => <button className="alternative" key={item.id} onClick={() => onSelect(item.id)}><ProductImage src={assetUrl(item.imageUrl)} fallbackSrc={fallbackSrc} alt="" /><span><strong>{item.title}</strong><small>{matchNames[item.match]} · {offerSource(item).label}</small><span>{formatMoney(item.price, item.currency)}</span></span><ChevronDown className="alternative-arrow" size={16} /></button>)}</div>}
  </>;
}

