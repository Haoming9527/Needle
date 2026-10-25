import { API_BASE } from '../extension/transport/client';
import type { ApiError } from '../../shared/types';

export class RequestError extends Error {
  constructor(message: string, public code = 'REQUEST_FAILED', public retryable = true) { super(message); }
}

function assertActive(signal: AbortSignal): void {
  if (signal.aborted && signal.reason?.name === 'TimeoutError') throw new RequestError('The local service took too long to respond. Try again.', 'TIMEOUT');
  signal.throwIfAborted();
}

export async function apiRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const requestSignal = signal ?? AbortSignal.timeout(45000);
  assertActive(requestSignal);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: requestSignal });
  } catch {
    assertActive(requestSignal);
    throw new RequestError('Needle cannot reach its local service. Start the backend, then try again.', 'SERVICE_UNAVAILABLE');
  }
  const result: unknown = await response.json().catch(() => null);
  // Fetch can resolve before its body finishes. Cancellation must cover both.
  assertActive(requestSignal);
  if (!response.ok) {
    const problem = result as ApiError | null;
    throw new RequestError(problem?.error?.message ?? 'The request could not be completed. Try again.', problem?.error?.code, problem?.error?.retryable);
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new RequestError('The local service returned an incomplete response. Try again.', 'INVALID_RESPONSE');
  return result as T;
}
