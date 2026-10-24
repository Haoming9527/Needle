import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { IntentHypothesis, IntentObservation, IntentState } from '../../shared/intent';
import { intentSuggestionKey } from '../../shared/intent';
import type { SynthesisOutput } from '../../shared/synthesis';
import type { SearchResponse } from '../../shared/types';
import { IntentWorkspace } from '../../src/panel/IntentWorkspace';
import '../../src/panel/styles.css';

if (!import.meta.env.DEV) throw new Error('The scripted synthesis fixture is development-only.');
type Scenario = 'supported' | 'abstain' | 'error';
let scenario: Scenario = 'supported';
let failNext = false;
let revision = 1;
let aiCalls = 0;
let productSearches = 0;
let savedConstraints = '';
const signal = () => window.dispatchEvent(new Event('fixture-counts'));
const observations: IntentObservation[] = [
  { id: '20000000-0000-4000-8000-000000000001', action: 'revisit', sourceOrigin: 'https://recipes.example', sourceTitle: 'Weekday meal preparation', summary: 'Revisited a guide to preparing lunches ahead of time.', tags: ['meal-prep'], provenance: 'demo_fixture', entityKey: 'fixture-recipe', createdAt: '2026-10-25T00:00:00Z' },
  { id: '20000000-0000-4000-8000-000000000002', action: 'dwell', sourceOrigin: 'https://cycling.example', sourceTitle: 'Cycling to work', summary: 'Spent time reading a guide to the daily bicycle commute.', tags: ['cycle-commute'], provenance: 'demo_fixture', entityKey: 'fixture-commute', createdAt: '2026-10-25T00:01:00Z' },
];
function seed(): IntentState {
  return { consent: true, attentionConsent: false, observations: structuredClone(observations), hypotheses: [], synthesis: { available: true, contextKey: `fixture-context-${revision}`, status: 'idle', model: 'fixture-response', promptVersion: 'scripted-fixture-v1', observations: observations.map(item => ({ id: item.id, sourceKey: item.sourceOrigin, sourceTitle: item.sourceTitle, summary: item.summary, action: item.action, tags: item.tags, provenance: item.provenance })) } };
}
let state = seed();
const json = () => Response.json(structuredClone(state));
const failure = (message: string, status = 409) => Response.json({ error: { code: 'SCRIPTED_FIXTURE', message, retryable: true } }, { status });
function invalidate() { revision++; state.synthesis!.contextKey = `fixture-context-${revision}`; state.synthesis!.status = 'stale'; state.hypotheses = []; }
function output(correction?: string): SynthesisOutput {
  const home = !!correction;
  return { outcome: 'hypothesis', label: home ? 'Meal preparation at home' : 'Lunch on the move', need: home ? 'You want to prepare and store meals for eating at home.' : 'You might want to bring prepared lunches on a bicycle commute.', why: home ? 'Your correction changes the objective: meal preparation still matters, but carrying lunch on a commute does not.' : 'Meal preparation and daily cycling may share a practical constraint: carrying a prepared lunch comfortably.', uncertainty: home ? 'Storage space and portion size still need your input. Interest does not imply purchase readiness.' : 'You may eat at home or be reading for someone else. These observations do not establish shopping intent.', question: home ? 'Would food storage for meals at home be useful?' : 'Would a way to carry lunch on your commute be useful?', productQuery: home ? 'food storage container' : 'portable lunch container', evidence: observations.map((item, index) => ({ observationId: item.id, reason: index === 0 ? 'Meal preparation is supported by the recipe guide.' : home ? 'The commute is observed but your correction says it is not the meal constraint.' : 'The commuting guide suggests a possible carrying context.' })) };
}
function hypothesis(result: SynthesisOutput, correction?: string): IntentHypothesis {
  return { id: 'fixture-ai-connection', label: result.label!, question: result.question!, interest: 'tentative', readiness: 'exploring', evidencePoints: 0, evidenceIds: observations.map(item => item.id), explanation: 'Scripted fixture output. No model was called.', status: 'active', recommendationKey: 'contextual', ...(savedConstraints ? { constraints: savedConstraints } : {}), origin: { kind: 'model', model: 'fixture-response', promptVersion: 'scripted-fixture-v1', evidenceFingerprint: `${state.synthesis!.contextKey}:${correction ?? ''}`, productQuery: result.productQuery! }, connection: { observations: state.observations.map(item => ({ observationId: item.id, sourceTitle: item.sourceTitle, action: item.action, summary: item.summary, provenance: item.provenance })), inferredNeed: { text: result.need!, basis: 'hypothesis' }, why: result.why!, evidenceReasons: result.evidence, uncertainty: result.uncertainty, question: result.question! } };
}
function offerFor(hypothesis: IntentHypothesis): SearchResponse {
  const home = hypothesis.origin!.productQuery.includes('storage');
  const title = home ? 'Stackable food storage containers' : 'Compact lunch container';
  return { sessionId: '30000000-0000-4000-8000-000000000001', mode: 'sample', agentMode: 'catalog', interpretation: { name: title, productType: 'food container', brand: null, model: null, color: null, attributes: [], queries: [hypothesis.origin!.productQuery], needsClarification: false, clarification: null }, warnings: ['Scripted development fixture. No model or retailer request.'], offers: [{ id: home ? 'fixture-home-storage' : 'fixture-portable-lunch', title, description: home ? 'Containers for prepared meals at home.' : 'A compact container for carrying a prepared lunch.', imageUrl: new URL(home ? '/assets/food-storage.svg' : '/assets/lunch.svg', location.origin).href, sourceUrl: null, match: 'similar', matchEvidence: 'Prepared fixture product selected after confirmation.', price: home ? 18000 : 24000, currency: 'KRW', observedAt: '2026-10-25T00:00:00Z', dataOrigin: 'sample', variants: ['Default'], shipping: null, availability: null, returns: null, reason: home ? 'The corrected objective is home meal storage.' : 'The confirmed objective is carrying lunch.', differences: [], priceIsIllustrative: true }] };
}
async function delay(signal?: AbortSignal | null) { await new Promise<void>((resolve, reject) => { if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; } const timer = setTimeout(resolve, 450); signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true }); }); }
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (url.origin !== 'http://127.0.0.1:4318') return originalFetch(input, init);
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const path = url.pathname;
  if (path === '/intent' && (!init?.method || init.method === 'GET')) return json();
  if (path === '/intent/synthesize') {
    if (!state.consent || body.contextKey !== state.synthesis!.contextKey || state.observations.length < 2) return failure('Scripted stale context or insufficient observations.');
    aiCalls++; signal();
    const key = state.synthesis!.contextKey;
    if (body.correction) { savedConstraints = state.hypotheses[0]?.constraints ?? savedConstraints; state.hypotheses = []; state.synthesis!.status = 'stale'; }
    await delay(init?.signal);
    if (key !== state.synthesis!.contextKey || !state.consent) return failure('Context changed while the scripted response was pending.');
    if (failNext || (scenario === 'error' && aiCalls === 1)) { failNext = false; signal(); return failure('Scripted provider error. Retry is available; no real model request occurred.', 502); }
    if (scenario === 'abstain') { state.hypotheses = []; state.synthesis = { ...state.synthesis!, status: 'abstained', result: { outcome: 'abstain', label: null, need: null, why: 'The scripted model declines to assume that meals and commuting belong to one need.', uncertainty: 'These topics may be unrelated. More context is needed.', question: null, productQuery: null, evidence: [] } }; return json(); }
    const result = output(body.correction);
    state.hypotheses = [hypothesis(result, body.correction)];
    state.synthesis = { ...state.synthesis!, status: 'ready', result, correction: body.correction, generatedAt: new Date().toISOString() };
    return json();
  }
  if (path.endsWith('/feedback')) {
    const current = state.hypotheses[0];
    if (!current || !state.consent) return failure('No active scripted hypothesis.');
    if (body.action === 'dismiss') current.status = 'dismissed';
    else if (body.action === 'confirm') { current.interest = 'confirmed'; current.constraints = body.constraints ?? current.constraints; savedConstraints = current.constraints ?? ''; current.connection.inferredNeed.basis = 'user_confirmed'; current.connection.productRationale = current.origin!.productQuery.includes('storage') ? 'Storage fits the corrected home meal-preparation need.' : 'Portability fits the confirmed meal and commute context.'; }
    return json();
  }
  if (path.endsWith('/recommendation')) {
    const current = state.hypotheses[0];
    if (!state.consent || !current || current.status !== 'active' || current.interest !== 'confirmed' || body.contextKey !== intentSuggestionKey(current)) return failure('Confirmation is required before a scripted product search.');
    productSearches++; signal(); const key = intentSuggestionKey(current); await delay(init?.signal);
    if (!state.hypotheses[0] || key !== intentSuggestionKey(state.hypotheses[0])) return failure('The confirmed need changed.');
    return Response.json(offerFor(current));
  }
  if (path === '/intent/consent') { state.consent = !!body.enabled; invalidate(); return json(); }
  if (path === '/intent/reset') { revision++; state = seed(); state.consent = false; state.observations = []; state.synthesis!.observations = []; return json(); }
  if (path.includes('/observations/') && path.endsWith('/remove')) { const id = decodeURIComponent(path.split('/')[3]); state.observations = state.observations.filter(item => item.id !== id); state.synthesis!.observations = state.synthesis!.observations.filter(item => item.id !== id); invalidate(); return json(); }
  return failure('This isolated fixture supports intent synthesis only.', 400);
};
function Fixture() {
  const [key, setKey] = useState(0);
  const [counts, setCounts] = useState({ aiCalls, productSearches });
  const [opened, setOpened] = useState('');
  useEffect(() => { const update = () => setCounts({ aiCalls, productSearches }); window.addEventListener('fixture-counts', update); return () => window.removeEventListener('fixture-counts', update); }, []);
  function load(next: Scenario) { scenario = next; revision++; aiCalls = 0; productSearches = 0; savedConstraints = ''; failNext = false; state = seed(); setOpened(''); signal(); setKey(value => value + 1); }
  return <><header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff1c9', borderBottom: '1px solid #d0b66e', padding: '12px 18px', font: '12px system-ui', lineHeight: 1.7 }}><strong>Development fixture · scripted AI responses, no model request</strong><div>All observations, reasoning and products below are test data. This is not live-model evidence.</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{(['supported', 'abstain', 'error'] as const).map(value => <button key={value} onClick={() => load(value)} style={{ padding: '7px 10px' }}>Load {value} scenario</button>)}<button onClick={() => { failNext = true; signal(); }} style={{ padding: '7px 10px' }}>Fail next scripted AI call</button><button onClick={() => window.dispatchEvent(new Event('focus'))} style={{ padding: '7px 10px' }}>Simulate focus refresh</button></div></header><div className="needle-app preview-app"><main><IntentWorkspace key={key} onOpenResult={result => setOpened(`View options received existing ${result.offers[0]?.title}; no additional search.`)} />{opened && <p role="status" style={{ padding: 12 }}>{opened}</p>}</main></div><footer style={{ position: 'sticky', bottom: 0, background: '#fff1c9', padding: 12, borderTop: '1px solid #d0b66e', font: '12px system-ui' }} aria-live="polite">Scripted AI calls: {counts.aiCalls} · Product searches: {counts.productSearches} · No external provider calls{failNext ? ' · Next scripted AI call will fail' : ''}</footer></>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
