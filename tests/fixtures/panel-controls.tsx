import { createRoot } from 'react-dom/client';
import type { CartItem, DemoOrder, DiscoverRequest, Offer, SearchResponse } from '../../shared/types';

const offer: Offer = {
  id: 'controls-headphones', title: 'Wireless headphones', description: 'Fixture headphones.', imageUrl: '/assets/photos/headphones.png', sourceUrl: null,
  match: 'similar', matchEvidence: 'Prepared preview only.', price: 149, currency: 'USD', observedAt: '2026-10-25T00:00:00.000Z', dataOrigin: 'sample',
  variants: ['Black'], availability: null, shipping: null, returns: null, reason: 'Prepared preview recommendation.', differences: [],
};
let items: CartItem[] = [{ id: 'ff81a0ec-7c75-4463-9c7b-028e2afcaa00', sessionId: '63720bec-0573-4cf4-b20a-a7a58f0320ad', offer, quantity: 1, variant: 'Black', createdAt: '2026-10-25T00:00:00.000Z' }];
let orders: DemoOrder[] = [{ id: 'PREVIEW-ORDER', confirmationId: '189e6137-353c-4979-92cc-2db4e194c97f', createdAt: '2026-10-25T00:00:00.000Z', status: 'simulated', title: 'Desk lamp', variant: 'White', price: 59, currency: 'USD', dataOrigin: 'sample', imageUrl: '/assets/photos/lamp.png', message: 'No payment taken.' }];
let clearedCart = 0, clearedHistory = 0, searchMode = 'none';
const report = () => { document.getElementById('fixture-events')!.textContent = `Cart clears: ${clearedCart} · History clears: ${clearedHistory} · Last search mode: ${searchMode}`; };
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith('http://127.0.0.1:4318/')) return originalFetch(input, init);
  const path = new URL(url).pathname;
  if (path === '/health') return Response.json({ status: 'ok', defaultMode: 'live', agentAvailable: true, liveAvailable: true, missingKeys: [], model: 'fixture' });
  if (path === '/cart') return Response.json({ items });
  if (path === '/orders') return Response.json({ orders });
  if (path === '/cart/clear' || path === '/orders/clear') {
    await new Promise(resolve => setTimeout(resolve, 350));
    if (path === '/cart/clear') { items = []; clearedCart++; report(); return Response.json({ items }); }
    orders = []; clearedHistory++; report(); return Response.json({ orders });
  }
  if (path === '/discover') {
    const body = JSON.parse(String(init?.body)) as DiscoverRequest;
    searchMode = body.mode ?? 'omitted'; report();
    return Response.json({ sessionId: crypto.randomUUID(), mode: body.mode ?? 'live', agentMode: 'catalog', offers: [offer], warnings: [], interpretation: { name: 'Wireless headphones', productType: 'headphones', brand: null, model: null, color: 'Black', attributes: [], queries: ['headphones'], needsClarification: false, clarification: null } } satisfies SearchResponse);
  }
  return Response.json({ error: { code: 'PREVIEW_ONLY', message: 'This fixture previews saved-item controls only.', retryable: false } }, { status: 400 });
};
const { default: App } = await import('../../src/panel/App');
createRoot(document.getElementById('root')!).render(<App />);
