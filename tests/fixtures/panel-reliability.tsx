import { createRoot } from 'react-dom/client';
import type { CartItem, Offer, SearchResponse } from '../../shared/types';

const offer: Offer = {
  id: 'recovery-headphones', title: 'Wireless headphones', description: 'Fixture headphones.', imageUrl: '/assets/photos/headphones.png', sourceUrl: null,
  match: 'similar', matchEvidence: 'Prepared preview only.', price: 149, currency: 'USD', observedAt: '2026-10-25T00:00:00.000Z', dataOrigin: 'sample',
  variants: ['Black', 'White'], availability: null, shipping: null, returns: null, reason: 'Prepared preview recommendation.', differences: [],
};
const sessionId = '63720bec-0573-4cf4-b20a-a7a58f0320ad';
const result: SearchResponse = {
  sessionId, mode: 'sample', agentMode: 'catalog', offers: [], warnings: [],
  interpretation: { name: 'Wireless headphones', productType: 'headphones', brand: null, model: null, color: 'Black', attributes: [], queries: ['headphones'], needsClarification: false, clarification: null },
};
let online = false, requests = 0;
const items: CartItem[] = [];
const operations = new Set<string>();
const report = () => { document.getElementById('fixture-events')!.textContent = `Service: ${online ? 'ready' : 'stopped'} · Cart requests: ${requests} · Unique additions: ${operations.size} · Saved quantity: ${items[0]?.quantity ?? 0}`; };
document.getElementById('start-service')!.addEventListener('click', () => { online = true; report(); });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith('http://127.0.0.1:4318/')) return originalFetch(input, init);
  if (!online) throw new TypeError('Fixture service is stopped.');
  const path = new URL(url).pathname;
  if (path === '/health') return Response.json({ status: 'ok', defaultMode: 'sample', agentAvailable: true, liveAvailable: true, missingKeys: [], model: 'fixture' });
  if (path === '/cart' && init?.method === 'POST') {
    const body = JSON.parse(String(init.body)) as { operationId?: string; variant?: string };
    requests++;
    const key = body.operationId || `missing-${requests}`;
    if (!operations.has(key)) {
      operations.add(key);
      if (items.length) items[0].quantity++;
      else items.push({ id: 'ff81a0ec-7c75-4463-9c7b-028e2afcaa00', sessionId, offer, quantity: 1, variant: body.variant ?? 'Black', createdAt: '2026-10-25T00:00:00.000Z' });
    }
    report();
    if (requests === 1) throw new TypeError('Fixture drops the first reply after saving.');
    return Response.json({ items });
  }
  if (path === '/cart') return Response.json({ items });
  if (path === '/orders') return Response.json({ orders: [] });
  if (path === '/discover') return Response.json(result);
  if (path === '/clarify') return Response.json({ ...result, sessionId: crypto.randomUUID(), offers: [offer] });
  return Response.json({ error: { code: 'PREVIEW_ONLY', message: 'Use this fixture to test connection recovery, clarification, and cart retry.', retryable: false } }, { status: 400 });
};
const { default: App } = await import('../../src/panel/App');
createRoot(document.getElementById('root')!).render(<App />);
report();
