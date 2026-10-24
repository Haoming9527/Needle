import { useCallback, useEffect, useRef, useState } from 'react';
import type { IntentFeedback, IntentHypothesis, IntentObservationInput, IntentState, RecommendationKey } from '../../shared/intent';
import { apiRequest } from './api';
import { intentSuggestionKey } from '../../shared/intent';
import type { IntentSynthesisState } from '../../shared/synthesis';
import type { IntentCaptureMetadata } from '../../shared/attention';
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
const recommendations: Partial<Record<RecommendationKey, { query: string; title: string; detail: string }>> = {
  'portable-lunch': { query: 'portable lunch container', title: 'Explore lunch on the move', detail: 'Look for a portable container suited to carrying prepared meals on your commute.' },
  'home-meal-prep': { query: 'food storage container', title: 'Explore food storage at home', detail: 'The commute is no longer the shopping constraint. Explore containers for preparing and storing meals at home.' },
  recording: { query: 'microphone', title: 'Explore recording microphones', detail: 'Compare microphones for a recording setup.' },
  'work-calls': { query: 'headset for work calls', title: 'Explore a work-call headset', detail: 'Focus on everyday calls rather than a recording setup.' },
};
type Connection = {
  observations: { observationId: string; sourceTitle: string; action: string; summary: string; provenance: string; capture?: IntentCaptureMetadata }[];
  inferredNeed: { text: string; basis: 'hypothesis' | 'user_confirmed' | 'user_corrected' };
  uncertainty: string;
  question: string;
  productRationale?: string;
  why?: string;
  evidenceReasons?: { observationId: string; reason: string }[];
};
type ModelHypothesis = IntentHypothesis & { origin?: { kind: 'model'; model: string; promptVersion: string; evidenceFingerprint: string; productQuery: string } };
type WorkspaceState = Omit<IntentState, 'hypotheses'> & { synthesis?: IntentSynthesisState; hypotheses: ModelHypothesis[] };
const readinessNames = { exploring: 'Exploring', considering: 'Considering', conditional: 'Conditional', ready_to_review: 'Ready to review' };

function ArticlePreview({ kind, compact = false }: { kind: 'recipe' | 'commute'; compact?: boolean }) {
  return <article className={`browsing-article ${compact ? 'browsing-article-compact' : ''}`}>
    <div className="browsing-address">{kind === 'recipe' ? 'recipes.example' : 'cycling.example'} <span>Demo article</span></div>
    <div className={`browsing-illustration browsing-${kind}`} aria-hidden="true">{kind === 'recipe' ? <><i /><i /><i /><span>Sunday, sorted.</span></> : <><i /><i /><span>Take the scenic route.</span></>}</div>
    <div className="browsing-copy"><small>{kind === 'recipe' ? 'Everyday food · 4 minute read' : 'Life on two wheels · 5 minute read'}</small><h2>{kind === 'recipe' ? 'Three lunches you can prepare on Sunday' : 'Making your weekday bike commute easier'}</h2>{!compact && <><p>{kind === 'recipe' ? 'Roast a tray of vegetables, cook your favourite grain, and mix a dressing. A little preparation makes the weekday lunch break simpler.' : 'Try a quieter route, check the forecast, and plan what to carry. Small changes can make the journey to work feel easier.'}</p><blockquote>{kind === 'recipe' ? 'Make a little extra today. Give yourself more time tomorrow.' : 'Pack lightly. Leave a little earlier. Find a route you enjoy.'}</blockquote></>}</div>
  </article>;
}

export function IntentWorkspace({ onDiscover, onOpenResult, onChanged }: { onDiscover?: (query: string) => void; onOpenResult?: (result: SearchResponse) => void; onChanged?: () => void }) {
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [mutationBusy, setBusy] = useState(false);
  const [synthBusy, setSynthBusy] = useState(false);
  const [synthError, setSynthError] = useState('');
  const [correction, setCorrection] = useState('');
  const [showRules, setShowRules] = useState(false);
  const synthesisRequest = useRef<AbortController | null>(null);
  const currentContext = useRef('');
  const stateRevision = useRef(0);
  const busy = mutationBusy || synthBusy;
  const [error, setError] = useState('');
  const [constraints, setConstraints] = useState('');
  const [product, setProduct] = useState<SearchResponse | null>(null);
  const [productBusy, setProductBusy] = useState(false);
  const [productError, setProductError] = useState('');
  const [retry, setRetry] = useState(0);
  const request = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const mounted = useRef(true);
  const synthesis = state?.synthesis;
  currentContext.current = synthesis?.contextKey ?? '';
  const eligible = new Set(synthesis?.observations.map(item => item.sourceKey) ?? []).size >= 2;
  const modelActive = !synthBusy && !synthError && synthesis?.status === 'ready' ? state?.hypotheses.find(item => item.status === 'active' && item.origin?.kind === 'model') : undefined;
  const active = showRules ? state?.hypotheses.find(item => item.status === 'active' && item.origin?.kind !== 'model') : modelActive;
  const hasReplayRecipe = state?.observations.some(item => item.sourceOrigin === recipes[0].sourceOrigin && !item.capture);
  const hasReplayCycling = state?.observations.some(item => item.sourceOrigin === cycling[0].sourceOrigin && !item.capture);
  const hasRecipe = state?.observations.some(item => item.sourceOrigin === recipes[0].sourceOrigin || item.capture?.sourceId === 'recipe-guide');
  const hasCycling = state?.observations.some(item => item.sourceOrigin === cycling[0].sourceOrigin || item.capture?.sourceId === 'commute-guide');
  const recommendation = active?.origin?.kind === 'model' ? { query: active.origin.productQuery, title: 'Explore this confirmed need', detail: active.connection.productRationale ?? '' } : active ? recommendations[active.recommendationKey] : null;
  const query = recommendation ? `${recommendation.query}${active?.constraints ? `; ${active.constraints}` : ''}` : '';
  const suggestionKey = active ? intentSuggestionKey(active) : '';
  const connection = (active as (IntentHypothesis & { connection?: Connection }) | undefined)?.connection;
  const observed = connection?.observations ?? (active?.evidenceIds ?? []).flatMap(id => (state?.observations ?? []).filter(item => item.id === id).map(item => ({ ...item, observationId: item.id })));
  const refresh = useCallback(async () => {
    const revision = stateRevision.current;
    try { const result = await apiRequest<WorkspaceState>('/intent', undefined, AbortSignal.timeout(8000)); if (mounted.current && revision === stateRevision.current) { if (synthesisRequest.current && (result.synthesis?.contextKey !== currentContext.current || !result.consent)) { synthesisRequest.current.abort(); synthesisRequest.current = null; setSynthBusy(false); setSynthError('Context changed. Review the observations before connecting them again.'); } setState(result); setError(''); } }
    catch (problem) { if (mounted.current) setError(problem instanceof Error ? problem.message : 'Context could not be loaded.'); }
  }, []);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; request.current?.abort(); synthesisRequest.current?.abort(); }; }, [refresh]);
  useEffect(() => { const onFocus = () => { if (!mutation.current) void refresh(); }; window.addEventListener('focus', onFocus); return () => window.removeEventListener('focus', onFocus); }, [refresh]);
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
  }, [state?.consent, suggestionKey, query, retry]);
  function invalidateSynthesis() { synthesisRequest.current?.abort(); synthesisRequest.current = null; setSynthBusy(false); }
  async function synthesize(userCorrection?: string) {
    if (mutation.current || synthesisRequest.current || !state?.consent || !synthesis?.available || !eligible) return;
    const contextKey = synthesis.contextKey; stateRevision.current++;
    const controller = new AbortController(); synthesisRequest.current = controller;
    setSynthBusy(true); setSynthError(''); setShowRules(false); invalidateProduct();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const result = await apiRequest<WorkspaceState>('/intent/synthesize', { contextKey, ...(userCorrection?.trim() ? { correction: userCorrection.trim() } : {}) }, controller.signal);
      if (!mounted.current || controller.signal.aborted || synthesisRequest.current !== controller || currentContext.current !== contextKey) return;
      if (result.synthesis?.contextKey !== contextKey) { setSynthError('The observations changed during synthesis. Refresh context and try again.'); return; }
      stateRevision.current++; setState(result); setCorrection(''); onChanged?.();
    } catch (problem) { if (mounted.current && synthesisRequest.current === controller) { setSynthError(controller.signal.aborted ? 'AI synthesis timed out. Your observations are preserved; retry when ready.' : problem instanceof Error ? problem.message : 'AI synthesis could not finish.'); await refresh(); } }
    finally { clearTimeout(timeout); if (synthesisRequest.current === controller) { synthesisRequest.current = null; if (mounted.current) setSynthBusy(false); } }
  }
  function invalidateProduct() { const controller = request.current; request.current = null; controller?.abort(); setProduct(null); setProductBusy(false); setProductError(''); }
  async function mutate(path: string, body: unknown) {
    if (mutation.current) return;
    mutation.current = true; stateRevision.current++; setBusy(true); setError(''); invalidateSynthesis(); invalidateProduct();
    try { const result = await apiRequest<WorkspaceState>(path, body, AbortSignal.timeout(8000)); if (mounted.current) { setState(result); setRetry(value => value + 1); onChanged?.(); } }
    catch (problem) { if (mounted.current) setError(problem instanceof Error ? problem.message : 'Your change could not be saved.'); }
    finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }
  async function replay(events: IntentObservationInput[]) {
    if (mutation.current || !state?.consent) return;
    mutation.current = true; stateRevision.current++; setBusy(true); setError(''); invalidateSynthesis(); invalidateProduct();
    try {
      let result: WorkspaceState | null = null;
      for (const event of events) result = await apiRequest<WorkspaceState>('/intent/observations', { ...event, id: crypto.randomUUID() }, AbortSignal.timeout(8000));
      if (mounted.current && result) { setState(result); setRetry(value => value + 1); onChanged?.(); }
    } catch (problem) { if (mounted.current) { setError(problem instanceof Error ? problem.message : 'The replay could not finish. Retry to continue.'); await refresh(); } }
    finally { mutation.current = false; if (mounted.current) setBusy(false); }
  }
  function revealEvidence(id: string) { document.getElementById(`observation-${id}`)?.closest('details')?.setAttribute('open', ''); }
  function feedback(value: IntentFeedback) { if (active) void mutate(`/intent/hypotheses/${encodeURIComponent(active.id)}/feedback`, value); }
  const dismissed = state?.hypotheses.some(item => item.status === 'dismissed');
  const offer = product?.offers[0];
  return <section className="intent-workspace browsing-workspace" aria-label="From everyday browsing to a useful discovery">
    <div className="intent-eyebrow">Needle · Discover</div><h1>A useful connection.<br />Before a shopping search.</h1>
    <p className="intent-lead">Browse two everyday moments. See what might connect them. Decide whether it fits.</p>
    <div className="browsing-mode"><strong>Controlled browsing demo</strong><span>Measure real cursor time within two prepared reading regions. Timing is measured; article content and topic labels are demo context.</span></div>
    {error && <div className="intent-error" role="alert">{error} <button className="text-button" onClick={() => void refresh()} disabled={busy}>Retry</button></div>}
    {!state && !error && <p className="intent-empty" role="status">Loading your context…</p>}
    {state && !state.consent && <div className="intent-consent"><h2>{state.observations.length ? 'Context memory is paused' : 'Review your browsing context'}</h2><p>Local memory stores the observations you choose to enable. Cursor attention has a separate opt-in on the reading pages. You can review, remove or reset the context.</p><button className="primary-button" disabled={busy} onClick={() => void mutate('/intent/consent', { enabled: true })}>{state.observations.length ? 'Resume local memory' : 'Enable local memory'}</button></div>}
    <section className="measured-source-launch" aria-label="Read the controlled demo sources"><h2>Start with something ordinary.</h2><p>Open each reading page, enable cursor attention, and spend time with your pointer inside the marked content. Return here to see what was recorded.</p><div className="measured-source-links"><a href="http://127.0.0.1:5173/recipe-demo.html" target="_blank" rel="noreferrer"><span>01 · Meal preparation</span><strong>Three lunches for the week</strong><small>Prepared source · local demo page ↗</small></a><a href="http://127.0.0.1:5173/commute-demo.html" target="_blank" rel="noreferrer"><span>02 · Bicycle commuting</span><strong>A calmer ride to work</strong><small>Prepared source · local demo page ↗</small></a></div><div className="measured-source-status" aria-live="polite">{(['recipe-guide', 'commute-guide'] as const).map(sourceId => { const observation = state?.observations.find(item => item.capture?.sourceId === sourceId); return <div key={sourceId}><i className={observation ? 'recorded' : ''} aria-hidden="true"/><strong>{sourceId === 'recipe-guide' ? 'Meal preparation' : 'Bicycle commuting'}</strong><span>{observation?.capture ? `${(observation.capture.dwellMs / 1000).toFixed(1)}s in region · ${observation.action === 'revisit' ? 'revisit' : 'region dwell'}` : 'Waiting for region dwell'}</span></div>; })}</div><p className="browsing-footnote">Both pages run on the same local origin. The two prepared source identities are separate demo contexts, not independent real websites.</p><button className="text-button" disabled={busy} onClick={() => void refresh()}>Refresh recorded context</button></section>
    <section className="synthesis-control" aria-label="Connect saved observations with AI"><div className="intent-eyebrow">03 · Connect the context</div><h2>What might these moments have in common?</h2><p>Send the bounded saved summaries below to your configured AI provider. The model can suggest a tentative need or say there is no supported connection. It does not receive screenshots or your full browsing history.</p><details className="synthesis-inputs"><summary>Preview the exact observation inputs ({synthesis?.observations.length ?? 0})</summary>{synthesis?.observations.length ? <pre>{JSON.stringify(synthesis.observations, null, 2)}</pre> : <p>No model input is available yet.</p>}</details><button className="primary-button" disabled={busy || !state?.consent || !eligible || !synthesis?.available} onClick={() => void synthesize()}>{synthBusy ? 'Connecting the observations…' : 'Connect observations with AI'}</button>{synthBusy && <button className="text-button" onClick={() => { invalidateSynthesis(); setSynthError('AI synthesis cancelled. No new connection was accepted.'); }}>Cancel synthesis</button>}<p className="browsing-footnote">{!state?.consent ? 'Enable local memory before sending context.' : !synthesis?.available ? 'AI synthesis is unavailable. Configure a provider to use this action; the prepared rule demo remains available below.' : !eligible ? 'Collect observations from at least two distinct sources first.' : `Provider model: ${synthesis.model} · ${synthesis.promptVersion}`}</p>{synthBusy && <p role="status">Considering the saved evidence. No product search starts until you confirm a need.</p>}{synthError && <div className="intent-error" role="alert">{synthError}{correction.trim() && <div className="synthesis-correction"><label>Your correction is preserved<input value={correction} onChange={event => setCorrection(event.target.value)} maxLength={500} disabled={busy} /></label><button className="secondary-button" disabled={busy || !state?.consent || !synthesis?.available || !eligible || !correction.trim()} onClick={() => void synthesize(correction)}>Retry this correction</button></div>}</div>}{!synthBusy && !synthError && synthesis?.status === 'abstained' && <div className="synthesis-empty"><strong>No supported connection</strong><p>{synthesis.result?.uncertainty ?? 'The model could not establish a useful need from these observations.'}</p>{synthesis.result?.why && <p>{synthesis.result.why}</p>}</div>}{synthesis?.status === 'stale' && <p className="synthesis-empty">The saved context changed. Connect the current observations again to get a fresh hypothesis.</p>}<button className="text-button synthesis-fallback" aria-pressed={showRules} onClick={() => { invalidateProduct(); setShowRules(value => !value); }}>{showRules ? 'Hide prepared rule-based demo' : 'Show prepared rule-based demo'}</button></section>
    <details className="synthetic-replay-fallback"><summary>Use a synthetic replay instead</summary><p>Fallback only: Continue adds fixture observations. It does not measure your cursor.</p>
    {state?.consent && (!hasReplayRecipe || !hasReplayCycling) && <div className="browsing-stage">
      <p className="browsing-step">{hasReplayRecipe ? '02 · Another everyday moment' : '01 · Something you were reading'}</p>
      {hasReplayRecipe && <div className="browsing-previous"><span>Previously explored</span><strong>Three lunches you can prepare on Sunday</strong><small>recipes.example · synthetic signal recorded</small></div>}
      <ArticlePreview kind={hasReplayRecipe ? 'commute' : 'recipe'} />
      <div className="browsing-next"><p><strong>What Continue simulates:</strong> pausing on this article and revisiting it. These are fixture inputs, not measured behaviour.</p><button className="primary-button" disabled={busy} onClick={() => void replay(hasReplayRecipe ? cycling : recipes)}>{busy ? 'Adding demo context…' : hasReplayRecipe || hasReplayCycling ? 'See what Needle connected' : 'Continue to the next article'} →</button></div>
      {!hasReplayRecipe && <p className="browsing-footnote">No product request. No recommendation from a single clue.</p>}
    </div>}
    {hasReplayRecipe && hasReplayCycling && <div className="browsing-completed-sources"><ArticlePreview kind="recipe" compact /><ArticlePreview kind="commute" compact /></div>}
    </details>
    {showRules && state && hasCycling && !active && <div className="intent-connection"><p className="intent-kicker">{dismissed ? 'Your choice, respected' : 'No connection yet'}</p><h2>{dismissed ? 'We’ll leave it there.' : 'The clues don’t yet support a need.'}</h2><p>{dismissed ? 'No product search will run for this dismissed suggestion. Reset the demo below if you want to try again.' : 'Review the stored observations below. Needle needs complementary evidence from different sources.'}</p></div>}
    {active && <article className="intent-connection browsing-reveal" aria-label="Needle’s connection">
      <p className="intent-kicker">{active.origin?.kind === 'model' ? `AI-generated hypothesis · ${active.origin.model}` : 'Prepared rule-based demo'} · {active.interest === 'confirmed' ? 'checked with you' : 'tentative'}</p>
      <div className="browsing-reasoning"><div><span>{observed.some(item => item.capture) ? 'Measured on controlled demo pages' : observed.some(item => item.provenance === 'demo_fixture') ? 'Observed in this simulation' : 'Observed context'}</span><ul>{observed.map(item => <li key={item.observationId}><a className="synthesis-citation" href={`#observation-${item.observationId}`} onClick={() => revealEvidence(item.observationId)}>[{(state?.observations.findIndex(observation => observation.id === item.observationId) ?? 0) + 1}]</a> {item.summary}<small>{item.sourceTitle} · {item.capture ? `${(item.capture.dwellMs / 1000).toFixed(1)}s in reading region · ${item.action} · prepared topic context` : item.provenance === 'demo_fixture' ? 'synthetic signal' : 'observed action'}</small></li>)}</ul></div><div><span>{active.interest === 'confirmed' ? 'Your confirmed need' : 'Possible connection'}</span><p>{connection?.inferredNeed.text ?? (active.recommendationKey === 'home-meal-prep' ? 'You prepare meals to eat at home, so storage matters more than carrying lunch.' : 'You may prepare lunches ahead and carry them on your cycle commute.')}</p></div><div className="browsing-uncertainty"><span>What we don’t know</span><p>{connection?.uncertainty ?? 'You could eat at home or simply be browsing. These clues do not mean you want to buy anything.'}</p></div></div>
      {connection?.why && <div className="synthesis-why"><h3>Why these observations connect</h3><p>{connection.why}</p>{connection.evidenceReasons?.map(evidence => <p key={evidence.observationId}><a className="synthesis-citation" href={`#observation-${evidence.observationId}`} onClick={() => revealEvidence(evidence.observationId)}>[{(state?.observations.findIndex(item => item.id === evidence.observationId) ?? 0) + 1}]</a> {evidence.reason}</p>)}</div>}
      <h2>{active.interest === 'confirmed' ? active.label : connection?.question ?? 'Would a way to carry lunch on your commute be useful?'}</h2>
      {active.interest !== 'confirmed' && <label className="intent-constraint">Anything that matters? (optional)<input value={constraints} maxLength={300} onChange={event => setConstraints(event.target.value)} placeholder="Under KRW 30,000…" disabled={busy || !state?.consent} /></label>}
      <div className="intent-feedback">{active.interest !== 'confirmed' && <button className="primary-button" disabled={busy || !state?.consent} onClick={() => feedback({ action: 'confirm', ...(constraints.trim() ? { constraints: constraints.trim() } : {}) })}>Yes, that fits</button>}{active.recommendationKey === 'portable-lunch' && <button className="secondary-button" disabled={busy || !state?.consent} onClick={() => feedback({ action: 'correct', correction: 'home-meal-prep', ...(constraints.trim() ? { constraints: constraints.trim() } : {}) })}>I eat at home</button>}<button className="text-button" disabled={busy || !state?.consent} onClick={() => feedback({ action: 'dismiss' })}>Dismiss</button></div>
      {active.origin?.kind === 'model' && <form className="synthesis-correction" onSubmit={event => { event.preventDefault(); void synthesize(correction); }}><label>Correct the connection<input value={correction} onChange={event => setCorrection(event.target.value)} maxLength={500} placeholder="For example, I eat at home" disabled={busy || !state?.consent} /></label><p>Your correction goes to the configured AI provider with the current saved summaries. The revised hypothesis needs confirmation.</p><button className="secondary-button" disabled={busy || !correction.trim() || !state?.consent}>Reconsider with AI</button></form>}
      {active.constraints && <p className="browsing-footnote">Your constraint: {active.constraints}</p>}
    </article>}
    {state?.consent && active?.interest === 'confirmed' && <section className="browsing-product" aria-label="One useful product"><p className="intent-eyebrow">04 · One useful possibility</p>{productBusy && <p role="status">Finding an option for your confirmed need…</p>}{productError && <div className="intent-error" role="alert">{productError}<button className="text-button" disabled={busy || productBusy} onClick={() => setRetry(value => value + 1)}>Retry product search</button></div>}{offer && product && <><ProductImage src={assetUrl(offer.imageUrl)} alt={offer.title} /><div className="browsing-product-copy"><span className="intent-badge">{offer.dataOrigin === 'sample' || offer.priceIsIllustrative ? 'Illustrative demo offer' : 'Retrieved listing · verify terms'}</span><h2>{offer.title}</h2><strong>{formatMoney(offer.price, offer.currency)}</strong><p>{connection?.productRationale ?? recommendation?.detail}</p><p className="browsing-footnote">{offer.reason} No purchase has been made.</p>{(onOpenResult || onDiscover) && <button className="secondary-button" onClick={() => onOpenResult ? onOpenResult(product) : onDiscover?.(query)}>View options →</button>}</div></>}</section>}
    {state && <details className="intent-review"><summary>Review context & controls <span>{state.observations.length} {state.observations.length === 1 ? 'clue' : 'clues'}</span></summary><div className="intent-toolbar"><span className="intent-status">Local memory {state.consent ? 'on' : 'paused'}</span><button disabled={mutationBusy} onClick={() => void mutate('/intent/consent', { enabled: !state.consent })}>{state.consent ? 'Pause memory' : 'Resume memory'}</button></div>{active && active.origin?.kind !== 'model' && <div className="intent-math"><p>Interest: {active.interest}. Purchase readiness: {readinessNames[active.readiness]}.</p><p>{active.explanation}</p><p>Heuristic points, not purchase probabilities: dwell/revisit 2; find 3; save/wishlist/group interest 4; cart 5. Repeated related events merge. Passive signals are capped per site. Complementary source topics and at least 4 points are required.</p></div>}<ul className="intent-evidence">{state.observations.map(item => <li key={item.id} id={`observation-${item.id}`} tabIndex={-1}><div className="intent-evidence-body"><strong>{item.sourceTitle}</strong><p>{item.summary}</p><small>{item.capture ? `${item.capture.actualOrigin} · ${(item.capture.dwellMs / 1000).toFixed(1)}s in reading region · visit ${item.capture.visitOrdinal} · ${item.action} · prepared demo source ${item.capture.sourceId}` : `${item.sourceOrigin} · ${item.action} · ${item.provenance === 'demo_fixture' ? 'synthetic demo signal' : 'observed action'}`}</small></div><button disabled={mutationBusy} aria-label={`Remove ${item.sourceTitle} observation`} onClick={() => void mutate(`/intent/observations/${encodeURIComponent(item.id)}/remove`, {})}>Remove</button></li>)}</ul><div className="intent-toolbar"><button disabled={mutationBusy} onClick={() => { setConstraints(''); void mutate('/intent/reset', {}); }}>Reset stored context</button><button disabled={mutationBusy} onClick={() => { invalidateProduct(); setRetry(value => value + 1); void refresh(); }}>Refresh</button></div></details>}
    {busy && <p className="intent-pause-note" role="status">Updating local context…</p>}
  </section>;
}
