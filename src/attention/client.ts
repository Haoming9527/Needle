import { attentionSourceForUrl, type AttentionCapture } from '../../shared/attention';
import type { IntentState } from '../../shared/intent';
import { apiRequest, RequestError } from '../panel/api';
import { mountAttentionCollector } from './collector';

export interface AttentionStatus {
  phase: 'paused' | 'ready' | 'tracking' | 'recorded' | 'error';
  message: string;
  observationCount: number;
}

/** Controlled source pages are another producer of the existing local intent memory.
 * No screenshot, page text, pointer trail, or search request leaves this module. */
export function mountAttentionCapture({ onStatus }: { onStatus: (status: AttentionStatus) => void }): () => void {
  const source = attentionSourceForUrl(window.location.href);
  if (!source) {
    onStatus({ phase: 'paused', message: 'Cursor attention is available only on the two controlled demo pages.', observationCount: 0 });
    return () => {};
  }
  let sessionId = crypto.randomUUID();
  try {
    const stored = sessionStorage.getItem('needle.attention.session');
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored)) sessionId = stored as typeof sessionId;
    else sessionStorage.setItem('needle.attention.session', sessionId);
  } catch { /* Storage restrictions do not prevent an in-memory session. */ }
  const pageInstanceId = crypto.randomUUID();
  let stopped = false;
  let enabled = false;
  let count = 0;
  let visits = 0;
  let stopCollector: (() => void) | undefined;
  let pending: AttentionCapture | undefined;
  let sending = false;
  let pollRequest: AbortController | undefined;
  let sendRequest: AbortController | undefined;
  let revision = 0;
  const status = (phase: AttentionStatus['phase'], message: string) => {
    if (!stopped) onStatus({ phase, message, observationCount: count });
  };
  const stop = () => { stopCollector?.(); stopCollector = undefined; };
  const updateCounts = (state: IntentState) => {
    count = new Set(state.observations.flatMap(value => value.capture ? [value.capture.sourceId] : [])).size;
    const previous = state.observations.find(value => value.capture?.sourceId === source.id && value.capture.sessionId === sessionId);
    visits = previous?.capture?.visitOrdinal ?? 0;
  };
  const start = () => {
    if (stopped || !enabled || stopCollector || pending || document.visibilityState !== 'visible') return;
    stopCollector = mountAttentionCollector({
      document, targetId: source.targetId, initialVisitOrdinal: visits,
      onTracking: tracking => {
        if (!sending && !pending) status(tracking ? 'tracking' : 'ready', tracking
          ? 'Measuring a pause on this reading region…'
          : 'Ready. Pause your cursor on the outlined reading region for two seconds.');
      },
      onObservation: measurement => {
        if (!enabled || pending || sending || stopped || document.visibilityState !== 'visible') return;
        pending = {
          id: crypto.randomUUID(), sessionId, pageInstanceId, sourceId: source.id, targetId: source.targetId,
          action: measurement.action,
          measurement: { dwellMs: measurement.dwellMs, visitOrdinal: measurement.visitOrdinal },
          capturedAt: new Date().toISOString(), documentUrl: `${window.location.origin}${source.path}`,
        };
        void send();
      },
    });
  };
  const applyState = (state: IntentState) => {
    updateCounts(state);
    const wasEnabled = enabled;
    enabled = state.consent && state.attentionConsent;
    if (!enabled) {
      if (wasEnabled) revision++;
      stop(); pending = undefined; sendRequest?.abort();
      status('paused', 'Cursor attention is paused. Enable it to measure this demo reading region.');
    } else if (!wasEnabled || !stopCollector) {
      start();
      if (!pending) status('ready', 'Ready. Pause your cursor on the outlined reading region for two seconds.');
    }
  };
  async function refresh() {
    if (stopped || document.visibilityState !== 'visible') return;
    pollRequest?.abort();
    const controller = new AbortController(); pollRequest = controller;
    const current = revision;
    try {
      const state = await apiRequest<IntentState>('/intent', undefined, controller.signal);
      if (!stopped && !controller.signal.aborted && current === revision) applyState(state);
    } catch (error) {
      if (stopped || controller.signal.aborted) return;
      revision++; enabled = false; stop(); sendRequest?.abort();
      status('error', error instanceof Error ? error.message : 'Unable to check cursor-attention consent.');
    }
  }
  async function send() {
    if (!pending || sending || !enabled || stopped) return;
    const capture = pending;
    const current = revision;
    const controller = new AbortController(); sendRequest = controller;
    sending = true;
    try {
      const state = await apiRequest<IntentState>('/intent/attention', capture, controller.signal);
      if (stopped || controller.signal.aborted || current !== revision) return;
      pending = undefined;
      applyState(state);
      if (enabled) status('recorded', `${capture.action === 'revisit' ? 'Return visit' : 'Cursor pause'} recorded: ${(capture.measurement.dwellMs / 1000).toFixed(1)} seconds. ${count} of 2 demo sources connected.`);
    } catch (error) {
      if (stopped || controller.signal.aborted || current !== revision) return;
      stop();
      if (error instanceof RequestError && ['ATTENTION_CONSENT_REQUIRED', 'INTENT_CONSENT_REQUIRED'].includes(error.code)) {
        pending = undefined; enabled = false; void refresh();
      } else {
        status('error', 'This cursor pause could not be saved. Retry recording to send the same observation again.');
      }
    } finally { sending = false; }
  }
  const consentChanged = () => {
    revision++; enabled = false; pending = undefined;
    stop(); pollRequest?.abort(); sendRequest?.abort();
    status('paused', 'Checking cursor-attention settings…');
    void refresh();
  };
  const visibilityChanged = () => {
    if (document.visibilityState !== 'visible') stop();
    else void refresh();
  };
  const retry = () => { if (pending) void send(); else void refresh(); };
  const focus = () => { void refresh(); };
  window.addEventListener('needle-attention-consent', consentChanged);
  window.addEventListener('needle-attention-retry', retry);
  window.addEventListener('focus', focus);
  document.addEventListener('visibilitychange', visibilityChanged);
  const interval = window.setInterval(() => { void refresh(); }, 1500);
  status('paused', 'Checking cursor-attention settings…');
  void refresh();
  return () => {
    stopped = true; revision++; stop(); pending = undefined;
    pollRequest?.abort(); sendRequest?.abort(); window.clearInterval(interval);
    window.removeEventListener('needle-attention-consent', consentChanged);
    window.removeEventListener('needle-attention-retry', retry);
    window.removeEventListener('focus', focus);
    document.removeEventListener('visibilitychange', visibilityChanged);
  };
}
