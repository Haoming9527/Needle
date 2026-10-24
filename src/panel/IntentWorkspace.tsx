import { useCallback, useEffect, useRef, useState } from 'react';
import type { IntentFeedback, IntentHypothesis, IntentObservationInput, IntentState, RecommendationKey } from '../../shared/intent';
import { apiRequest } from './api';
import { intentSuggestionKey } from '../../shared/intent';
import type { SearchResponse } from '../../shared/types';
import { ProductImage, formatMoney } from './ui';
import { assetUrl } from './CheckoutDialog';
import './intent.css';

const recipes: IntentObservationInput[] = [
  { id: '10000000-0000-4000-8000-000000000001', action: 'dwell', sourceOrigin: 'https://recipes.example', sourceTitle: 'Weekday meal preparation', summary: 'Paused on a guide to preparing lunches ahead of time.', tags: ['meal-prep'], provenance: 'demo_fixture', entityKey: 'recipe-lunch-prep' },
  { id: '10000000-0000-4000-8000-000000000002', action: 'revisit', sourceOrigin: 'https://recipes.example', sourceTitle: 'Weekday meal preparation', summary: 'Revisited the same meal-preparation guide.', tags: ['meal-prep'], provenance: 'demo_fixture', entityKey: 'recipe-lunch-prep' },
];
const cycling: IntentObservationInput[] = [
  { id: '10000000-0000-4000-8000-000000000003', action: 'dwell', sourceOrigin: 'https://cycling.example', sourceTitle: 'Cycling to work', summary: 'Paused on a guide to commuting by bicycle.', tags: ['cycle-commute'], provenance: 'demo_fixture', entityKey: 'cycle-to-work' },
  { id: '10000000-0000-4000-8000-000000000004', action: 'revisit', sourceOrigin: 'https://cycling.example', sourceTitle: 'Cycling to work', summary: 'Revisited advice for the daily bicycle commute.', tags: ['cycle-commute'], provenance: 'demo_fixture', entityKey: 'cycle-to-work' },
];
const recommendations: Record<RecommendationKey, { query: string; title: string; detail: string }> = {
  'portable-lunch': { query: 'portable lunch container', title: 'Explore lunch on the move', detail: 'Look for a portable container suited to carrying prepared meals on your commute.' },
  'home-meal-prep': { query: 'food storage container', title: 'Explore food storage at home', detail: 'The commute is no longer the shopping constraint. Explore containers for preparing and storing meals at home.' },
  recording: { query: 'microphone', title: 'Explore recording microphones', detail: 'Compare microphones for a recording setup.' },
  'work-calls': { query: 'headset for work calls', title: 'Explore a work-call headset', detail: 'Focus on everyday calls rather than a recording setup.' },
};
type Connection = {
  observations: { observationId: string; sourceTitle: string; action: string; summary: string; provenance: string }[];
  inferredNeed: { text: string; basis: 'hypothesis' | 'user_confirmed' | 'user_corrected' };
  uncertainty: string;
  question: string;
  productRationale?: string;
};
const readinessNames = { exploring: 'Exploring', considering: 'Considering', conditional: 'Conditional', ready_to_review: 'Ready to review' };

function ArticlePreview({ kind, compact = false }: { kind: 'recipe' | 'commute'; compact?: boolean }) {
  return <article className={`browsing-article ${compact ? 'browsing-article-compact' : ''}`}>
    <div className="browsing-address">{kind === 'recipe' ? 'recipes.example' : 'cycling.example'} <span>Demo article</span></div>
    <div className={`browsing-illustration browsing-${kind}`} aria-hidden="true">{kind === 'recipe' ? <><i /><i /><i /><span>Sunday, sorted.</span></> : <><i /><i /><span>Take the scenic route.</span></>}</div>
    <div className="browsing-copy"><small>{kind === 'recipe' ? 'Everyday food · 4 minute read' : 'Life on two wheels · 5 minute read'}</small><h2>{kind === 'recipe' ? 'Three lunches you can prepare on Sunday' : 'Making your weekday bike commute easier'}</h2>{!compact && <><p>{kind === 'recipe' ? 'Roast a tray of vegetables, cook your favourite grain, and mix a dressing. A little preparation makes the weekday lunch break simpler.' : 'Try a quieter route, check the forecast, and plan what to carry. Small changes can make the journey to work feel easier.'}</p><blockquote>{kind === 'recipe' ? 'Make a little extra today. Give yourself more time tomorrow.' : 'Pack lightly. Leave a little earlier. Find a route you enjoy.'}</blockquote></>}</div>
  </article>;
}

export function IntentWorkspace({ onDiscover, onOpenResult, onChanged }: { onDiscover?: (query: string) => void; onOpenResult?: (result: SearchResponse) => void; onChanged?: () => void }) {
  const [state, setState] = useState<IntentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [constraints, setConstraints] = useState('');
  const [product, setProduct] = useState<SearchResponse | null>(null);
  const [productBusy, setProductBusy] = useState(false);
  const [productError, setProductError] = useState('');
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const mounted = useRef(true);
  const active = state?.hypotheses.find(item => item.status === 'active');
  const hasRecipe = state?.observations.some(item => item.sourceOrigin === recipes[0].sourceOrigin);
  const hasCycling = state?.observations.some(item => item.sourceOrigin === cycling[0].sourceOrigin);
  const recommendation = active ? recommendations[active.recommendationKey] : null;
  const query = recommendation ? `${recommendation.query}${active?.constraints ? `; ${active.constraints}` : ''}` : '';
  const connection = (active as (IntentHypothesis & { connection?: Connection }) | undefined)?.connection;
  const observed = connection?.observations ?? (active?.evidenceIds ?? []).flatMap(id => (state?.observations ?? []).filter(item => item.id === id).map(item => ({ ...item, observationId: item.id })));
  const refresh = useCallback(async () => {
    try { const result = await apiRequest<IntentState>('/intent', undefined, AbortSignal.timeout(8000)); if (mounted.current) { setState(result); setError(''); } }
    catch (problem) { if (mounted.current) setError(problem instanceof Error ? problem.message : 'Context could not be loaded.'); }
  }, []);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; request.current?.abort(); }; }, [refresh]);
  // A change to evidence, consent or feedback invalidates the product and its in-flight response.
  useEffect(() => {
    request.current?.abort(); setProduct(null); setProductError(''); setProductBusy(false);
    if (!state?.consent || active?.interest !== 'confirmed' || !query) return;
    const controller = new AbortController(); request.current = controller; setProductBusy(true);
    const timeout = setTimeout(() => controller.abort(), 45000);
    void apiRequest<SearchResponse>(`/intent/hypotheses/${encodeURIComponent(active.id)}/recommendation`, { contextKey: intentSuggestionKey(active) }, controller.signal).then(result => {
      if (controller.signal.aborted || request.current !== controller || !mounted.current) return;
      if (!result.offers.length) setProductError('No suitable catalog match yet. Try again or adjust the need.');
      else setProduct(result);
    }).catch(problem => {
      if (request.current !== controller || !mounted.current) return;
      setProductError(controller.signal.aborted ? 'The product search took too long. You can retry.' : problem instanceof Error ? problem.message : 'The product could not be loaded.');
    }).finally(() => { clearTimeout(timeout); if (request.current === controller && mounted.current) setProductBusy(false); });
    return () => { request.current = null; controller.abort(); clearTimeout(timeout); };
  }, [state, query, retry]);
  function invalidateProduct() { const controller = request.current; request.current = null; controller?.abort(); setProduct(null); setProductBusy(false); setProductError(''); }
  async function mutate(path: string, body: unknown) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(''); invalidateProduct();
    try { const result = await apiRequest<IntentState>(path, body, AbortSignal.timeout(8000)); if (mounted.current) { setState(result); onChanged?.(); } }
    catch (problem) { if (mounted.current) setError(problem instanceof Error ? problem.message : 'Your change could not be saved.'); }
    finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }
  async function replay(events: IntentObservationInput[]) {
    if (mutation.current || !state?.consent) return;
    mutation.current = true; setBusy(true); setError(''); invalidateProduct();
    try {
      let result: IntentState | null = null;
      for (const event of events) result = await apiRequest<IntentState>('/intent/observations', { ...event, id: crypto.randomUUID() }, AbortSignal.timeout(8000));
      if (mounted.current && result) { setState(result); onChanged?.(); }
    } catch (problem) { if (mounted.current) { setError(problem instanceof Error ? problem.message : 'The replay could not finish. Retry to continue.'); await refresh(); } }
    finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }
  function feedback(value: IntentFeedback) { if (active) void mutate(`/intent/hypotheses/${encodeURIComponent(active.id)}/feedback`, value); }
  const dismissed = state?.hypotheses.some(item => item.status === 'dismissed');
  const offer = product?.offers[0];
  return <section className="intent-workspace browsing-workspace" aria-label="From everyday browsing to a useful discovery">
    <div className="intent-eyebrow">Needle · Discover</div><h1>A useful connection.<br />Before a shopping search.</h1>
    <p className="intent-lead">Browse two everyday moments. See what might connect them. Decide whether it fits.</p>
    <div className="browsing-mode"><strong>Simulated browsing</strong><span>Demo articles and synthetic attention signals. Your mouse is not being tracked.</span></div>
    {error && <div className="intent-error" role="alert">{error} <button className="text-button" onClick={() => void refresh()} disabled={busy}>Retry</button></div>}
    {!state && !error && <p className="intent-empty" role="status">Loading your context…</p>}
    {state && !state.consent && <div className="intent-consent"><h2>{state.observations.length ? 'Context memory is paused' : 'Try the browsing story'}</h2><p>With your permission, this walkthrough stores labelled demo observations locally. You can review, remove or reset them.</p><button className="primary-button" disabled={busy} onClick={() => void mutate('/intent/consent', { enabled: true })}>{state.observations.length ? 'Resume local memory' : 'Start browsing demo'}</button></div>}
    {state?.consent && (!hasRecipe || !hasCycling) && <div className="browsing-stage">
      <p className="browsing-step">{hasRecipe ? '02 · Another everyday moment' : '01 · Something you were reading'}</p>
      {hasRecipe && <div className="browsing-previous"><span>Previously explored</span><strong>Three lunches you can prepare on Sunday</strong><small>recipes.example · synthetic signal recorded</small></div>}
      <ArticlePreview kind={hasRecipe ? 'commute' : 'recipe'} />
      <div className="browsing-next"><p><strong>What Continue simulates:</strong> pausing on this article and revisiting it. These are fixture inputs, not measured behaviour.</p><button className="primary-button" disabled={busy} onClick={() => void replay(hasRecipe ? cycling : recipes)}>{busy ? 'Adding demo context…' : hasRecipe || hasCycling ? 'See what Needle connected' : 'Continue to the next article'} →</button></div>
      {!hasRecipe && <p className="browsing-footnote">No product request. No recommendation from a single clue.</p>}
    </div>}
    {hasRecipe && hasCycling && <div className="browsing-completed-sources"><ArticlePreview kind="recipe" compact /><ArticlePreview kind="commute" compact /></div>}
    {state && hasCycling && !active && <div className="intent-connection"><p className="intent-kicker">{dismissed ? 'Your choice, respected' : 'No connection yet'}</p><h2>{dismissed ? 'We’ll leave it there.' : 'The clues don’t yet support a need.'}</h2><p>{dismissed ? 'No product search will run for this dismissed suggestion. Reset the demo below if you want to try again.' : 'Review the stored observations below. Needle needs complementary evidence from different sources.'}</p></div>}
    {active && <article className="intent-connection browsing-reveal" aria-label="Needle’s connection">
      <p className="intent-kicker">{active.interest === 'confirmed' ? 'Checked with you' : '03 · A possible connection'}</p>
      <div className="browsing-reasoning"><div><span>Observed in this {observed.some(item => item.provenance === 'demo_fixture') ? 'simulation' : 'context'}</span><ul>{observed.map(item => <li key={item.observationId}>{item.summary}<small>{item.sourceTitle} · {item.provenance === 'demo_fixture' ? 'synthetic signal' : 'observed action'}</small></li>)}</ul></div><div><span>{active.interest === 'confirmed' ? 'Your confirmed need' : 'Possible connection'}</span><p>{connection?.inferredNeed.text ?? (active.recommendationKey === 'home-meal-prep' ? 'You prepare meals to eat at home, so storage matters more than carrying lunch.' : 'You may prepare lunches ahead and carry them on your cycle commute.')}</p></div><div className="browsing-uncertainty"><span>What we don’t know</span><p>{connection?.uncertainty ?? 'You could eat at home or simply be browsing. These clues do not mean you want to buy anything.'}</p></div></div>
      <h2>{active.interest === 'confirmed' ? active.label : connection?.question ?? 'Would a way to carry lunch on your commute be useful?'}</h2>
      {active.interest !== 'confirmed' && <label className="intent-constraint">Anything that matters? (optional)<input value={constraints} maxLength={300} onChange={event => setConstraints(event.target.value)} placeholder="Under KRW 30,000…" disabled={busy || !state?.consent} /></label>}
      <div className="intent-feedback">{active.interest !== 'confirmed' && <button className="primary-button" disabled={busy || !state?.consent} onClick={() => feedback({ action: 'confirm', ...(constraints.trim() ? { constraints: constraints.trim() } : {}) })}>Yes, that fits</button>}{active.recommendationKey === 'portable-lunch' && <button className="secondary-button" disabled={busy || !state?.consent} onClick={() => feedback({ action: 'correct', correction: 'home-meal-prep', ...(constraints.trim() ? { constraints: constraints.trim() } : {}) })}>I eat at home</button>}<button className="text-button" disabled={busy || !state?.consent} onClick={() => feedback({ action: 'dismiss' })}>Dismiss</button></div>
      {active.constraints && <p className="browsing-footnote">Your constraint: {active.constraints}</p>}
    </article>}
    {state?.consent && active?.interest === 'confirmed' && <section className="browsing-product" aria-label="One useful product"><p className="intent-eyebrow">04 · One useful possibility</p>{productBusy && <p role="status">Finding an option for your confirmed need…</p>}{productError && <div className="intent-error" role="alert">{productError}<button className="text-button" disabled={busy || productBusy} onClick={() => setRetry(value => value + 1)}>Retry product search</button></div>}{offer && product && <><ProductImage src={assetUrl(offer.imageUrl)} alt={offer.title} /><div className="browsing-product-copy"><span className="intent-badge">{offer.dataOrigin === 'sample' || offer.priceIsIllustrative ? 'Illustrative demo offer' : 'Retrieved listing · verify terms'}</span><h2>{offer.title}</h2><strong>{formatMoney(offer.price, offer.currency)}</strong><p>{connection?.productRationale ?? recommendation?.detail}</p><p className="browsing-footnote">{offer.reason} No purchase has been made.</p>{(onOpenResult || onDiscover) && <button className="secondary-button" onClick={() => onOpenResult ? onOpenResult(product) : onDiscover?.(query)}>View options →</button>}</div></>}</section>}
    {state && <details className="intent-review"><summary>Review context & controls <span>{state.observations.length} {state.observations.length === 1 ? 'clue' : 'clues'}</span></summary><div className="intent-toolbar"><span className="intent-status">Local memory {state.consent ? 'on' : 'paused'}</span><button disabled={busy} onClick={() => void mutate('/intent/consent', { enabled: !state.consent })}>{state.consent ? 'Pause memory' : 'Resume memory'}</button></div>{active && <div className="intent-math"><p>Interest: {active.interest}. Purchase readiness: {readinessNames[active.readiness]}.</p><p>{active.explanation}</p><p>Heuristic points, not purchase probabilities: dwell/revisit 2; find 3; save/wishlist/group interest 4; cart 5. Repeated related events merge. Passive signals are capped per site. Complementary source topics and at least 4 points are required.</p></div>}<ul className="intent-evidence">{state.observations.map(item => <li key={item.id}><div className="intent-evidence-body"><strong>{item.sourceTitle}</strong><p>{item.summary}</p><small>{item.sourceOrigin} · {item.action} · {item.provenance === 'demo_fixture' ? 'synthetic demo signal' : 'observed action'}</small></div><button disabled={busy} aria-label={`Remove ${item.sourceTitle} observation`} onClick={() => void mutate(`/intent/observations/${encodeURIComponent(item.id)}/remove`, {})}>Remove</button></li>)}</ul><div className="intent-toolbar"><button disabled={busy} onClick={() => { setConstraints(''); void mutate('/intent/reset', {}); }}>Reset stored context</button><button disabled={busy} onClick={() => { invalidateProduct(); void refresh(); }}>Refresh</button></div></details>}
    {busy && <p className="intent-pause-note" role="status">Updating local context…</p>}
  </section>;
}
