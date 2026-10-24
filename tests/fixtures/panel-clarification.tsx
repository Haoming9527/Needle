import { createRoot } from 'react-dom/client';
import type { CapturedSelection, ClarifyRequest, SearchResponse } from '../../shared/types';

const question: SearchResponse = {
  sessionId: 'c41004a6-a715-444d-9a8c-6c61a6418b13', mode: 'sample', agentMode: 'ai', offers: [], warnings: [],
  interpretation: { name: 'Your selected area', productType: 'object', brand: null, model: null, color: null, attributes: [], queries: ['podcast equipment'], needsClarification: true, clarification: 'Do you mean the microphone or the arm holding it?' },
};
const photo = await fetch('/assets/photos/podcast.png').then(response => response.blob());
const imageDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(photo); });
const captured: CapturedSelection = { id: 'clarification-preview', selection: { imageDataUrl, focus: { x: 0.3, y: 0.55 } }, needsCrop: false, result: question };
Object.defineProperty(globalThis, 'chrome', { configurable: true, value: { runtime: { id: 'clarification-preview' }, storage: { session: { get: async () => ({ 'needle.selection': captured }), remove: async () => {} }, onChanged: { addListener() {}, removeListener() {} } } } });
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith('http://127.0.0.1:4318/')) return originalFetch(input, init);
  const path = new URL(url).pathname;
  if (path === '/health') return Response.json({ status: 'ok', defaultMode: 'sample', liveAvailable: true, agentAvailable: true, model: 'preview', missingKeys: [] });
  if (path === '/cart') return Response.json({ items: [] });
  if (path === '/orders') return Response.json({ orders: [] });
  if (path === '/clarify') {
    const body = JSON.parse(String(init?.body)) as ClarifyRequest;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 1800);
      init?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
    });
    if (body.answer.toLowerCase() === 'fail') return Response.json({ error: { code: 'PREVIEW_FAILURE', message: 'Preview retry: your answer and selected crop have been kept.', retryable: true } }, { status: 502 });
    if (body.selection.imageDataUrl !== imageDataUrl || body.selection.focus?.x !== 0.3) throw new Error('The original selected crop was not preserved.');
    return Response.json({ ...question, sessionId: '80b98bcc-d244-4b8c-ad34-f2a992b95ac9', interpretation: { ...question.interpretation, name: 'Black microphone boom arm', productType: 'boom arm', needsClarification: false, clarification: null }, offers: [{ id: 'preview-arm', title: 'Microphone boom arm', description: 'Adjustable desk-mounted microphone arm.', imageUrl: '/assets/photos/boom-arm.png', sourceUrl: null, match: 'similar', matchEvidence: 'Shape and mounting style', price: 69, currency: 'USD', observedAt: new Date().toISOString(), dataOrigin: 'sample', variants: ['Black'], shipping: null, availability: null, returns: null, reason: 'A matching style for the arm you selected.', differences: [], priceIsIllustrative: true }] } satisfies SearchResponse);
  }
  return Response.json({ error: { code: 'PREVIEW_ONLY', message: 'This fixture previews clarification only.', retryable: false } }, { status: 400 });
};
const { default: App } = await import('../../src/panel/App');
createRoot(document.getElementById('root')!).render(<App />);
