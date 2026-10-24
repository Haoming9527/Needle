import { useCallback, useEffect, useState } from 'react';
import type { IntentFeedback, IntentHypothesis, IntentObservationInput, IntentState, RecommendationKey } from '../../shared/intent';
import { apiRequest } from './api';
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
const readinessNames = { exploring: 'Exploring', considering: 'Considering', conditional: 'Conditional', ready_to_review: 'Ready to review' };
const readinessWidths = { exploring: 15, considering: 40, conditional: 55, ready_to_review: 80 };

export function IntentWorkspace({ onDiscover, onChanged }: { onDiscover: (query: string) => void; onChanged?: () => void }) {
  const [state, setState] = useState<IntentState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [constraints, setConstraints] = useState('');
  const refresh = useCallback(async () => {
    try { setState(await apiRequest<IntentState>('/intent', undefined, AbortSignal.timeout(8000))); setError(''); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Context could not be loaded.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function mutate(path: string, body: unknown) {
    if (busy) return;
    setBusy(true); setError('');
    try { setState(await apiRequest<IntentState>(path, body, AbortSignal.timeout(8000))); onChanged?.(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Your change could not be saved.'); }
    finally { setBusy(false); }
  }
  async function replay(events: IntentObservationInput[]) {
    if (busy || !state?.consent) return;
    setBusy(true); setError('');
    try {
      for (const event of events) setState(await apiRequest<IntentState>('/intent/observations', { ...event, id: crypto.randomUUID() }, AbortSignal.timeout(8000)));
      onChanged?.();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'The replay could not finish. Retry to continue safely.'); }
    finally { setBusy(false); }
  }
  function feedback(hypothesis: IntentHypothesis, value: IntentFeedback) {
    void mutate(`/intent/hypotheses/${encodeURIComponent(hypothesis.id)}/feedback`, value);
  }
  const active = state?.hypotheses.filter(item => item.status === 'active') ?? [];
  const hasRecipe = state?.observations.some(item => item.sourceOrigin === recipes[0].sourceOrigin);
  const hasCycling = state?.observations.some(item => item.sourceOrigin === cycling[0].sourceOrigin);
  return <section className="intent-workspace" aria-label="Cross-site context">
    <div className="intent-eyebrow">A little context, a useful connection</div>
    <h1>Before you know<br />what to look for.</h1>
    <p className="intent-lead">Everyday interests can point to something useful. Needle connects the clues, then checks with you.</p>
    {error && <div className="intent-error" role="alert">{error} <button className="text-button" onClick={() => void refresh()} disabled={busy}>Retry</button></div>}
    {!state && !error && <p className="intent-empty" role="status">Loading your context…</p>}
    {state && !state.consent && <div className="intent-consent"><h2>Let context stay with you</h2><p>Enable local memory for observations you choose to add. This prototype uses explicit captures and labelled browsing replays; it does not passively track your browsing.</p><button className="primary-button" disabled={busy} onClick={() => void mutate('/intent/consent', { enabled: true })}>Enable local memory</button><p className="intent-pause-note">You can pause new observations, remove a clue, or reset stored context.</p></div>}
    {state?.consent && <div className="intent-toolbar"><span className="intent-status"><i className="intent-dot" />Local memory on</span><button disabled={busy} onClick={() => void mutate('/intent/consent', { enabled: false })}>Pause memory</button></div>}
    {state && <div className="intent-replay"><h2>Demo replay · two everyday moments</h2><p>Synthetic browsing signals, added one source at a time. No shopping request, wishlist, or cart is needed.</p><div className="intent-replay-actions"><button disabled={busy || !state.consent || hasRecipe} onClick={() => void replay(recipes)}>{hasRecipe ? '✓ Recipe source added' : '1. Replay meal prep'}<span>recipes.example · dwell + revisit</span></button><button disabled={busy || !state.consent || !hasRecipe || hasCycling} onClick={() => void replay(cycling)}>{hasCycling ? '✓ Cycling source added' : '2. Replay commute'}<span>cycling.example · dwell + revisit</span></button></div></div>}
    {state && active.length === 0 && <div className="intent-connection"><p className="intent-kicker">Still connecting the clues</p><h2>{state.observations.length ? 'A clue is not a need.' : 'No assumptions yet.'}</h2><p>{state.hypotheses.some(item => item.status === 'dismissed') ? 'You dismissed the suggestion. Needle will not treat it as a confirmed need.' : state.observations.length ? 'Needle needs complementary evidence from another source before suggesting a connection.' : 'Add the first source to see how ordinary browsing can become useful context.'}</p></div>}
    {active.map(hypothesis => {
      const recommendation = recommendations[hypothesis.recommendationKey];
      return <article className="intent-connection" key={hypothesis.id}>
        <p className="intent-kicker">{hypothesis.interest === 'confirmed' ? 'Checked with you' : 'A tentative connection'}</p>
        <h2>{hypothesis.interest === 'confirmed' ? hypothesis.label : hypothesis.question}</h2>
        <p>{hypothesis.explanation}</p>
        <div className="intent-scores"><div><span>Interest confidence</span><strong>{hypothesis.interest === 'confirmed' ? 'Confirmed by you' : 'Tentative'}</strong><span>{hypothesis.evidencePoints} evidence points · heuristic</span></div><div><span>Purchase readiness</span><strong>{readinessNames[hypothesis.readiness]}</strong><div className="intent-meter" aria-hidden="true"><i style={{ width: `${readinessWidths[hypothesis.readiness]}%` }} /></div><span>Interest does not mean ready to buy</span></div></div>
        {hypothesis.interest !== 'confirmed' && <label className="intent-constraint">Anything that matters? (optional)<input value={constraints} maxLength={300} onChange={event => setConstraints(event.target.value)} placeholder="Easy to carry, under KRW 30,000…" disabled={busy || !state?.consent} /></label>}
        <div className="intent-feedback">
          {hypothesis.interest !== 'confirmed' && <button className="primary-button" disabled={busy || !state?.consent} onClick={() => feedback(hypothesis, { action: 'confirm', ...(constraints.trim() ? { constraints: constraints.trim() } : {}) })}>Yes, that fits</button>}
          {(hypothesis.recommendationKey === 'portable-lunch' || hypothesis.recommendationKey === 'home-meal-prep') && hypothesis.recommendationKey !== 'home-meal-prep' && <button className="secondary-button" disabled={busy || !state?.consent} onClick={() => feedback(hypothesis, { action: 'correct', correction: 'home-meal-prep' })}>I eat at home</button>}
          <button className="text-button" disabled={busy || !state?.consent} onClick={() => feedback(hypothesis, { action: 'dismiss' })}>Dismiss</button>
        </div>
        {hypothesis.interest === 'confirmed' && <><p>{recommendation.detail}</p>{hypothesis.constraints && <p>You've asked for: {hypothesis.constraints}</p>}<button className="primary-button intent-next" disabled={busy || !state?.consent} onClick={() => onDiscover(`${recommendation.query}${hypothesis.constraints ? `; ${hypothesis.constraints}` : ''}`)}>{recommendation.title} →</button></>}
        <details className="intent-math"><summary>How the score works</summary><p>Dwell/revisit: 2; find: 3; save/wishlist/group interest: 4; cart: 5. Related actions are merged rather than counted repeatedly. Passive evidence is capped per source. A connection needs complementary topics from different sites and at least 4 evidence points.</p><p>This is a deterministic demo heuristic, not a purchase probability. Confirmation validates the need; it does not place an order.</p><p>Evidence used: {hypothesis.evidenceIds.map(id => state?.observations.find(observation => observation.id === id)?.sourceTitle ?? id).join(' + ')} = {hypothesis.evidencePoints} points after deduplication and caps.</p></details>
      </article>;
    })}
    {state && state.observations.length > 0 && <><h2 className="intent-evidence-title">The clues behind the connection</h2><ul className="intent-evidence">{state.observations.map(observation => <li key={observation.id}><span className="intent-source-symbol" aria-hidden="true">{observation.tags.includes('meal-prep') ? '◒' : observation.tags.includes('cycle-commute') ? '↗' : '✦'}</span><div className="intent-evidence-body"><strong>{observation.sourceTitle}</strong><p>{observation.summary}</p><small>{observation.sourceOrigin} · {observation.action.replace('_', ' ')}</small><span className="intent-badge">{observation.provenance === 'demo_fixture' ? 'Synthetic demo signal' : 'Observed action'}</span></div><button disabled={busy} aria-label={`Remove ${observation.sourceTitle} observation`} onClick={() => void mutate(`/intent/observations/${encodeURIComponent(observation.id)}/remove`, {})}>Remove</button></li>)}</ul></>}
    {state && <div className="intent-toolbar"><button disabled={busy} onClick={() => { setConstraints(''); void mutate('/intent/reset', {}); }}>Reset stored context</button><button disabled={busy} onClick={() => void refresh()}>Refresh</button></div>}
    {busy && <p className="intent-pause-note" role="status">Updating local context…</p>}
  </section>;
}
