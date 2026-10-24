import { API_BASE } from '../extension/client';
import type { ApiError } from '../../shared/types';

export class RequestError extends Error {
  constructor(message: string, public code = 'REQUEST_FAILED', public retryable = true) { super(message); }
}

export async function apiRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new RequestError('Needle cannot reach its local service. Start the backend, then try again.', 'SERVICE_UNAVAILABLE');
  }
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const problem = result as ApiError | null;
    throw new RequestError(problem?.error?.message ?? 'The request could not be completed. Try again.', problem?.error?.code, problem?.error?.retryable);
  }
  return result as T;
}
