import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../errors.js';

/** Restrict local API access before parsing request bodies or running routes. */
export const localRequestsOnly: RequestHandler = (req, res, next) => {
  const host = req.hostname;
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) {
    return next(new ApiError(403, 'LOCAL_ONLY', 'Needle only accepts local requests.'));
  }
  const origin = req.get('origin');
  const allowed = !origin
    || /^chrome-extension:\/\/[a-p]{32}$/.test(origin)
    || [
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:4318',
      'http://localhost:4318',
    ].includes(origin);
  if (!allowed) {
    return next(new ApiError(403, 'ORIGIN_DENIED', 'This page cannot access Needle’s local server.'));
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  if (req.method === 'POST' && !req.is('application/json')) {
    return next(new ApiError(415, 'JSON_REQUIRED', 'Requests must use application/json.'));
  }
  next();
};

/** Cancel disconnected requests and bound provider work to one request deadline. */
export function createRequestRunner(timeoutMs: number) {
  return async function runRequest<T>(
    req: Request,
    res: Response,
    work: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const disconnect = () => controller.abort();
    const responseClosed = () => {
      if (!res.writableEnded) controller.abort();
    };
    req.on('aborted', disconnect);
    res.on('close', responseClosed);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new ApiError(504, 'TIMEOUT', 'This search took too long. Try again or narrow your description.'));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      req.removeListener('aborted', disconnect);
      res.removeListener('close', responseClosed);
    }
  };
}

export const sendApiError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  let failure: ApiError;
  if (error instanceof ApiError) {
    failure = error;
  } else if (error instanceof z.ZodError) {
    const message = error.issues
      .map(issue => `${issue.path.join('.') || 'Request'}: ${issue.message}`)
      .join('; ')
      .slice(0, 900);
    failure = new ApiError(400, 'INVALID_REQUEST', message);
  } else if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    failure = new ApiError(413, 'IMAGE_TOO_LARGE', 'The selection is too large. Crop the image to the item and try again.');
  } else if (error instanceof SyntaxError) {
    failure = new ApiError(400, 'INVALID_JSON', 'The request could not be read. Please retry.');
  } else {
    failure = new ApiError(500, 'INTERNAL_ERROR', 'Needle could not finish this request. Please retry.');
  }
  res.status(failure.status).json({
    error: {
      code: failure.code,
      message: failure.message,
      retryable: [429, 500, 502, 504].includes(failure.status),
    },
  });
};
