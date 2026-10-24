import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { DiscoverRequest, DiscoveryMode, Interpretation, Preferences, SearchResponse, Selection } from '../shared/types.js';
import { agentAvailable, getConfig, missingKeys, type ServerConfig } from './config.js';
import { ApiError } from './errors.js';
import { publicImageUrl } from './evidence.js';
import { LiveProvider } from './live-provider.js';
import { NeedleDatabase } from './database.js';
import { CatalogAgentProvider } from './catalog-agent.js';
import { budgetFromInstruction } from './preferences.js';
import type { ProductProvider, ProviderResult } from './provider.js';
import { SampleProvider } from './sample-provider.js';
import { WebDemoProvider } from './web-demo-provider.js';
import { decideProducts } from './product-decision.js';
import { installVoiceRoutes } from './voice.js';

const preferenceSchema = z.object({ budget: z.number().finite().nonnegative().max(1_000_000_000).optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional() }).strict();
const imageDataSchema = z.string().max(6_000_000).regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/);
const selectionSchema = z.object({
  text: z.string().max(4000).optional(),
  imageDataUrl: imageDataSchema.optional(),
  annotatedImageDataUrl: imageDataSchema.optional(),
  focus: z.object({ x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1) }).strict().optional(),
  clarifications: z.array(z.object({ question: z.string().trim().min(1).max(500), answer: z.string().trim().min(1).max(1000) }).strict()).max(5).optional(),
  imageUrl: z.string().max(5000).refine(value => !!publicImageUrl(value), 'Use a public HTTPS image URL.').optional(),
  pageUrl: z.string().max(5000).url().optional(), pageTitle: z.string().max(500).optional(), capturedAt: z.string().max(50).optional(),
}).strict().refine(value => !!value.text?.trim() || !!value.imageDataUrl || !!value.imageUrl, 'Select an image or text, or add a description.')
  .refine(value => !value.annotatedImageDataUrl || (!!value.imageDataUrl && !!value.focus), 'A marked image requires the original crop and cursor position.');
const discoverSchema = z.object({ selection: selectionSchema, preferences: preferenceSchema.optional(), mode: z.enum(['sample', 'live']).optional() }).strict();
const refineSchema = z.object({ sessionId: z.string().uuid(), instruction: z.string().trim().min(1).max(1000), preferences: preferenceSchema.optional() }).strict();
const clarifySchema = z.object({ sessionId: z.string().uuid(), answer: z.string().trim().min(1).max(1000), selection: selectionSchema }).strict();
const orderSchema = z.object({ sessionId: z.string().uuid(), offerId: z.string().min(1).max(100), variant: z.string().min(1).max(100).optional(), confirmationId: z.string().min(8).max(100), confirmed: z.literal(true), cartItemId: z.string().uuid().optional(), quantity: z.number().int().min(1).max(99).optional() }).strict();
const cartSchema = z.object({ sessionId: z.string().uuid(), offerId: z.string().min(1).max(100), variant: z.string().min(1).max(100).optional(), quantity: z.number().int().min(1).max(99).optional() }).strict();

export interface AppOptions { config?: ServerConfig; sampleProvider?: ProductProvider; liveProvider?: ProductProvider; webDemoProvider?: ProductProvider; decisionProvider?: typeof decideProducts }

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? getConfig();
  const app = express();
  app.disable('x-powered-by');
  const database = new NeedleDatabase(config.databaseFile ?? (config.orderFile ? `${config.orderFile}.sqlite` : ':memory:'), config.orderFile);
  app.locals.database = database;
  const catalog = new SampleProvider(() => database.catalog());
  const providers = { sample: options.sampleProvider ?? (agentAvailable(config) ? new CatalogAgentProvider(config, catalog) : catalog), live: options.liveProvider ?? new LiveProvider(config) };
  const webDemoProvider = options.webDemoProvider ?? new WebDemoProvider(config);
  const decide = options.decisionProvider ?? decideProducts;
  const liveMissing = missingKeys(config);

  app.use((req, res, next) => {
    const host = req.hostname;
    if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) return next(new ApiError(403, 'LOCAL_ONLY', 'Needle only accepts local requests.'));
    const origin = req.get('origin');
    const allowed = !origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin) || ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4318', 'http://localhost:4318'].includes(origin);
    if (!allowed) return next(new ApiError(403, 'ORIGIN_DENIED', 'This page cannot access Needle’s local server.'));
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    if (req.method === 'POST' && !req.is('application/json')) return next(new ApiError(415, 'JSON_REQUIRED', 'Requests must use application/json.'));
    next();
  });
  app.use(express.json({ limit: '6mb' }));
  installVoiceRoutes(app, config, database);

  function checkLive(mode: string): void {
    if (mode === 'live' && liveMissing.length) throw new ApiError(503, 'LIVE_NOT_CONFIGURED', `Live discovery needs ${liveMissing.join(' and ')} in .env. You can use the prepared catalog meanwhile.`);
  }

  async function searchWithFallback(mode: DiscoveryMode, item: Interpretation, preferences: Preferences, signal: AbortSignal, instruction = '', selection?: Selection): Promise<ProviderResult & Pick<SearchResponse, 'discoverySource' | 'webSearch' | 'decision'>> {
    const rank = async (result: ProviderResult): Promise<ProviderResult & Pick<SearchResponse, 'decision'>> => {
      if (item.needsClarification || !result.offers.length) return result;
      const ranked = await decide(config, { item, preferences, instruction, selection, offers: result.offers }, signal);
      return { ...ranked, warnings: [...result.warnings, ...ranked.warnings] };
    };
    const primary = await rank(await providers[mode].search(item, preferences, signal, instruction));
    if (mode === 'live') return { ...primary, discoverySource: 'exa' };
    if (primary.offers.length || item.needsClarification) return { ...primary, discoverySource: 'catalog' };

    if (liveMissing.length) {
      const message = `No catalog match. Automatic web search needs ${liveMissing.join(' and ')} in .env. Add the missing key${liveMissing.length > 1 ? 's' : ''}, restart the server, and retry.`;
      return { ...primary, warnings: [...primary.warnings, message], discoverySource: 'catalog', webSearch: { status: 'unavailable', message } };
    }

    try {
      // Retrieval reuses the identified object; Decisions compares these candidates
      // against the original focused selection within the same request deadline.
      const web = await webDemoProvider.search(item, preferences, signal, instruction);
      const offers = database.cacheWebOffers(item, web.offers).filter(offer => preferences.budget === undefined || (offer.currency === preferences.currency && offer.price !== null && offer.price <= preferences.budget));
      const message = offers.length
        ? 'Found product references with Exa and added them to your demo catalog.'
        : 'Exa searched across stores but found no matching product references. Try a broader description or a brand/model name.';
      const ranked = await rank({ offers, warnings: [...primary.warnings, message, ...web.warnings] });
      return { ...ranked, discoverySource: 'exa', webSearch: { status: offers.length ? 'used' : 'empty', message: ranked.decision?.status === 'no_match' ? 'Products were found, but none was a suitable match for your selection. Try a clearer description or a different crop.' : message } };
    } catch (error) {
      if (signal.aborted) throw new ApiError(504, 'TIMEOUT', 'This search took too long. Try again or narrow your description.');
      const detail = error instanceof ApiError ? error.message : 'The web search service could not be reached. Please retry.';
      const message = `No catalog match. Automatic web search could not finish. ${detail}`;
      return { ...primary, warnings: [...primary.warnings, message], discoverySource: 'exa', webSearch: { status: 'failed', message } };
    }
  }

  async function bounded<T>(req: Request, res: Response, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const disconnect = () => controller.abort();
    const responseClosed = () => { if (!res.writableEnded) controller.abort(); };
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
          }, config.timeoutMs);
        }),
      ]);
    } finally { if (timer) clearTimeout(timer); req.removeListener('aborted', disconnect); res.removeListener('close', responseClosed); }
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok', defaultMode: config.defaultMode, liveAvailable: !liveMissing.length, missingKeys: liveMissing, model: config.model, agentAvailable: agentAvailable(config), agentMode: agentAvailable(config) ? 'ai' : 'catalog', voiceAvailable: !!config.openAiKey, decisionAvailable: !!config.openAiKey, database: 'sqlite' }));
  app.get('/cart', (_req, res) => res.json({ items: database.cart() }));
  app.get('/orders', (_req, res) => res.json({ orders: database.history() }));
  app.post('/cart', (req, res, next) => {
    try { const body = cartSchema.parse(req.body); res.json({ items: database.addCart(body.sessionId, body.offerId, body.variant, body.quantity) }); } catch (error) { next(error); }
  });
  app.post('/cart/:id/remove', (req, res, next) => {
    try { res.json({ items: database.removeCart(z.string().uuid().parse(req.params.id)) }); } catch (error) { next(error); }
  });
  app.post('/cart/:id/quantity', (req, res, next) => {
    try { const { quantity } = z.object({ quantity: z.number().int().min(1).max(99) }).strict().parse(req.body); res.json({ items: database.quantity(z.string().uuid().parse(req.params.id), quantity) }); } catch (error) { next(error); }
  });

  app.post('/discover', async (req, res, next) => {
    try {
      const body: DiscoverRequest = discoverSchema.parse(req.body);
      const mode = body.mode ?? config.defaultMode;
      checkLive(mode);
      const preferences = budgetFromInstruction(body.selection.text ?? '', {}, body.preferences);
      const result = await bounded(req, res, async signal => {
        const interpretation = await providers[mode].identify(body.selection, signal);
        const search = await searchWithFallback(mode, interpretation, preferences, signal, '', body.selection);
        return { sessionId: randomUUID(), mode, interpretation, ...search, agentMode: agentAvailable(config) ? 'ai' : 'catalog' } satisfies SearchResponse;
      });
      database.saveSession({ selection: body.selection, interpretation: result.interpretation, preferences, result });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/refine', async (req, res, next) => {
    try {
      const body = refineSchema.parse(req.body);
      const session = database.session(body.sessionId);
      checkLive(session.result.mode);
      const preferences = budgetFromInstruction(body.instruction, session.preferences, body.preferences);
      const search = await bounded(req, res, signal => searchWithFallback(session.result.mode, session.interpretation, preferences, signal, body.instruction, session.selection));
      const result: SearchResponse = { sessionId: randomUUID(), mode: session.result.mode, interpretation: session.interpretation, ...search, agentMode: agentAvailable(config) ? 'ai' : 'catalog' };
      // Keep the original session immutable so an already-reviewed order cannot change underneath its confirmation.
      database.saveSession({ selection: session.selection, interpretation: session.interpretation, preferences, result });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/clarify', async (req, res, next) => {
    try {
      const body = clarifySchema.parse(req.body);
      const session = database.session(body.sessionId);
      if (!session.interpretation.needsClarification) throw new ApiError(409, 'NO_QUESTION_PENDING', 'This item is already identified. Refine the search or select another object.');
      const mode = session.result.mode;
      checkLive(mode);
      // Images live with the browser selection, never in SQLite. Restore the saved
      // context and question so a reply cannot accidentally use a new video frame.
      const selection = {
        ...body.selection,
        ...session.selection,
        clarifications: [...(session.selection.clarifications ?? []).slice(-4), {
          question: session.interpretation.clarification || 'Which object do you want to find?',
          answer: body.answer,
        }],
      };
      const preferences = budgetFromInstruction(body.answer, session.preferences);
      const result = await bounded(req, res, async signal => {
        const interpretation = await providers[mode].identify(selection, signal);
        const search = await searchWithFallback(mode, interpretation, preferences, signal, '', selection);
        return { sessionId: randomUUID(), mode, interpretation, ...search, agentMode: agentAvailable(config) ? 'ai' : 'catalog' } satisfies SearchResponse;
      });
      database.saveSession({ selection, interpretation: result.interpretation, preferences, result });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post(['/orders', '/demo-orders'], (req, res, next) => {
    try {
      const body = orderSchema.parse(req.body);
      const { order, created } = database.purchase(body);
      return res.status(created ? 201 : 200).json(order);
    } catch (error) { next(error); }
  });

  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'This endpoint does not exist.')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let failure: ApiError;
    if (error instanceof ApiError) failure = error;
    else if (error instanceof z.ZodError) failure = new ApiError(400, 'INVALID_REQUEST', error.issues.map(issue => `${issue.path.join('.') || 'Request'}: ${issue.message}`).join('; ').slice(0, 900));
    else if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') failure = new ApiError(413, 'IMAGE_TOO_LARGE', 'The selection is too large. Crop the image to the item and try again.');
    else if (error instanceof SyntaxError) failure = new ApiError(400, 'INVALID_JSON', 'The request could not be read. Please retry.');
    else failure = new ApiError(500, 'INTERNAL_ERROR', 'Needle could not finish this request. Please retry.');
    res.status(failure.status).json({ error: { code: failure.code, message: failure.message, retryable: [429, 500, 502, 504].includes(failure.status) } });
  });
  return app;
}
