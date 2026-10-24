export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchJson<T>(url: string, init: RequestInit, service: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (init.signal?.aborted) throw new ApiError(504, 'TIMEOUT', 'This search took too long. Try again or narrow your description.');
    throw new ApiError(502, 'PROVIDER_UNAVAILABLE', `${service} could not be reached. Check your connection and try again.`);
  }
  if (!response.ok) {
    // Never expose upstream response bodies: they may contain private request context.
    if (response.status === 401 || response.status === 403) throw new ApiError(503, 'PROVIDER_ACCESS', `${service} access was denied. Check the server API key and account access.`);
    if (response.status === 429) throw new ApiError(429, 'RATE_LIMITED', `${service} is busy or its usage limit has been reached. Please retry later.`);
    throw new ApiError(502, 'PROVIDER_FAILED', `${service} could not complete the request. Please retry.`);
  }
  try { return await response.json() as T; }
  catch { throw new ApiError(502, 'INVALID_PROVIDER_RESPONSE', `${service} returned an unreadable response. Please retry.`); }
}
