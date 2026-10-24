import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { DiscoverRequest, DiscoveryMode, Interpretation, Preferences, SearchResponse } from '../shared/types.js';
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
import { IntentStore } from './intent.js';
import { createIntentRouter } from './intent-routes.js';
import { CommerceStore } from './commerce.js';
import { createCommerceRouter } from './commerce-routes.js';
import { contextTags } from '../shared/context.js';
import { intentTags, intentSuggestionKey, type RecommendationKey } from '../shared/intent.js';
import { SYNTHESIS_PROMPT_VERSION, type SynthesisProvider } from '../shared/synthesis.js';
import { AIIntentSynthesizer, validateSynthesisOutput } from './intent-synthesizer.js';

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

export interface AppOptions { config?: ServerConfig; sampleProvider?: ProductProvider; liveProvider?: ProductProvider; webDemoProvider?: ProductProvider; intentSynthesisProvider?: SynthesisProvider }

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? getConfig();
  const app = express();
  app.disable('x-powered-by');
  const database = new NeedleDatabase(config.databaseFile ?? (config.orderFile ? `${config.orderFile}.sqlite` : ':memory:'), config.orderFile);
  app.locals.database = database;
  const intent = new IntentStore(database.connection);
  const synthesisAvailable = !!options.intentSynthesisProvider || agentAvailable(config);
  intent.configureSynthesis({ available: synthesisAvailable, model: config.model, promptVersion: SYNTHESIS_PROMPT_VERSION });
  const synthesizer = options.intentSynthesisProvider ?? new AIIntentSynthesizer(config);
  let synthesisSequence = 0;
  let pendingSynthesis: { key: string; controller: AbortController } | undefined;
  const commerce = new CommerceStore(database.connection);
  app.locals.intent = intent;
  app.locals.commerce = commerce;
  const catalog = new SampleProvider(() => database.catalog());
  const providers = { sample: options.sampleProvider ?? (agentAvailable(config) ? new CatalogAgentProvider(config, catalog) : catalog), live: options.liveProvider ?? new LiveProvider(config) };
  const webDemoProvider = options.webDemoProvider ?? new WebDemoProvider(config);
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
  app.use(createIntentRouter(intent));
  app.use(createCommerceRouter(commerce, signal => {
    const item = signal.savedItem;
    const origin = item.sourceOrigin ?? 'https://needle.local';
    const entityKey = item.offer?.id ?? item.id;
    if (signal.type === 'group_buy_withdraw') { intent.retractAction(origin, entityKey, 'group_interest'); return; }
    if (signal.type === 'save_remove') { intent.retractAction(origin, entityKey, 'save'); intent.retractAction(origin, entityKey, 'wishlist'); return; }
    if (!intent.getState().consent) return;
    const tags = [...new Set([...item.tags, ...contextTags(`${item.label} ${item.summary ?? ''}`)])].filter((tag): tag is typeof intentTags[number] => (intentTags as readonly string[]).includes(tag));
    // Saved context can support a new need even outside the prepared topic taxonomy.
    intent.record({ id: signal.eventId, action: signal.type === 'group_buy_interest' ? 'group_interest' : item.offer ? 'wishlist' : 'save', sourceOrigin: origin, sourceTitle: (item.sourceTitle ?? item.label).slice(0, 200), summary: (item.summary ?? item.label).slice(0, 500), tags, provenance: item.provenance, entityKey });
  }));

  function cartSignal(offer: SearchResponse['offers'][number], action: 'add' | 'remove'): void {
    // Product recommendations are local commerce evidence, never a new external browsing source.
    if (action === 'remove') { intent.retractAction('https://needle.local', offer.id, 'cart'); return; }
    if (!intent.getState().consent) return;
    const tags = contextTags(`${offer.title} ${offer.description}`).filter((tag): tag is typeof intentTags[number] => (intentTags as readonly string[]).includes(tag));
    if (tags.length) intent.record({ id: randomUUID(), action: 'cart', sourceOrigin: 'https://needle.local', sourceTitle: 'Needle cart', summary: offer.title.slice(0, 500), tags, provenance: 'observed', entityKey: offer.id });
  }

  function checkLive(mode: string): void {
    if (mode === 'live' && liveMissing.length) throw new ApiError(503, 'LIVE_NOT_CONFIGURED', `Live discovery needs ${liveMissing.join(' and ')} in .env. You can use the prepared catalog meanwhile.`);
  }

  async function searchWithFallback(mode: DiscoveryMode, item: Interpretation, preferences: Preferences, signal: AbortSignal, instruction = ''): Promise<ProviderResult & Pick<SearchResponse, 'discoverySource' | 'webSearch'>> {
    const primary = await providers[mode].search(item, preferences, signal, instruction);
    if (mode === 'live') return { ...primary, discoverySource: 'exa' };
    if (primary.offers.length || item.needsClarification) return { ...primary, discoverySource: 'catalog' };

    if (liveMissing.length) {
      const message = `No catalog match. Automatic web search needs ${liveMissing.join(' and ')} in .env. Add the missing key${liveMissing.length > 1 ? 's' : ''}, restart the server, and retry.`;
      return { ...primary, warnings: [...primary.warnings, message], discoverySource: 'catalog', webSearch: { status: 'unavailable', message } };
    }

    try {
      // Reuse the already identified object and this request's deadline; do not send the image through vision again.
      const web = await webDemoProvider.search(item, preferences, signal, instruction);
      const offers = database.cacheWebOffers(item, web.offers).filter(offer => preferences.budget === undefined || (offer.currency === preferences.currency && offer.price !== null && offer.price <= preferences.budget));
      const message = offers.length
        ? 'Found product references with Exa and added them to your demo catalog.'
        : 'Exa searched across stores but found no matching product references. Try a broader description or a brand/model name.';
      return { offers, warnings: [...primary.warnings, message, ...web.warnings], discoverySource: 'exa', webSearch: { status: offers.length ? 'used' : 'empty', message } };
    } catch (error) {
      if (signal.aborted) throw new ApiError(504, 'TIMEOUT', 'This search took too long. Try again or narrow your description.');
      const detail = error instanceof ApiError ? error.message : 'The web search service could not be reached. Please retry.';
      const message = `No catalog match. Automatic web search could not finish. ${detail}`;
      return { ...primary, warnings: [...primary.warnings, message], discoverySource: 'exa', webSearch: { status: 'failed', message } };
    }
  }

  async function bounded<T>(req: Request, res: Response, work: (signal: AbortSignal) => Promise<T>, timeoutMessage = 'This search took too long. Try again or narrow your description.'): Promise<T> {
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
            reject(new ApiError(504, 'TIMEOUT', timeoutMessage));
          }, config.timeoutMs);
        }),
      ]);
    } finally { if (timer) clearTimeout(timer); req.removeListener('aborted', disconnect); res.removeListener('close', responseClosed); }
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok', defaultMode: config.defaultMode, liveAvailable: !liveMissing.length, missingKeys: liveMissing, model: config.model, agentAvailable: agentAvailable(config), agentMode: agentAvailable(config) ? 'ai' : 'catalog', database: 'sqlite' }));
  app.get('/cart', (_req, res) => res.json({ items: database.cart() }));
  app.get('/orders', (_req, res) => res.json({ orders: database.history() }));
  app.post('/cart', (req, res, next) => {
    try { const body = cartSchema.parse(req.body); const items = database.addCart(body.sessionId, body.offerId, body.variant, body.quantity); const item = items.find(value => value.offer.id === body.offerId); if (item) cartSignal(item.offer, 'add'); res.json({ items }); } catch (error) { next(error); }
  });
  app.post('/cart/:id/remove', (req, res, next) => {
    try { const id = z.string().uuid().parse(req.params.id); const previous = database.cart().find(value => value.id === id); const items = database.removeCart(id); if (previous && !items.some(value => value.offer.id === previous.offer.id)) cartSignal(previous.offer, 'remove'); res.json({ items }); } catch (error) { next(error); }
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
        const search = await searchWithFallback(mode, interpretation, preferences, signal);
        return { sessionId: randomUUID(), mode, interpretation, ...search, agentMode: agentAvailable(config) ? 'ai' : 'catalog' } satisfies SearchResponse;
      });
      database.saveSession({ selection: body.selection, interpretation: result.interpretation, preferences, result });
      res.json(result);
    } catch (error) { next(error); }
  });

  // Explicit analysis of saved summaries; no product tools or automatic calls from GET/polling.
  app.post('/intent/synthesize', async (req, res, next) => {
    let ownedController: AbortController | undefined;
    try {
      const body = z.object({ contextKey: z.string().min(1).max(200), correction: z.string().trim().min(1).max(500).optional() }).strict().parse(req.body);
      const state = intent.getState();
      if (!state.consent) throw new ApiError(409, 'INTENT_CONSENT_REQUIRED', 'Enable context memory before connecting your saved observations.');
      const snapshot = intent.synthesisSnapshot();
      if (snapshot.contextKey !== body.contextKey) throw new ApiError(409, 'INTENT_CONTEXT_CHANGED', 'Your observations changed. Review them before connecting them again.');
      if (new Set(snapshot.observations.map(value => value.sourceKey)).size < 2) throw new ApiError(422, 'SYNTHESIS_MORE_CONTEXT', 'Record context from at least two separate sources before asking AI to connect it.');
      const cached = state.synthesis;
      if (cached && ['ready', 'abstained'].includes(cached.status) && (cached.correction ?? '') === (body.correction ?? '')) return res.json(state);
      if (!synthesisAvailable) throw new ApiError(503, 'AI_NOT_CONFIGURED', 'Connect an AI provider in the local backend to analyze these observations. The prepared rule-based demo remains available separately.');
      const key = JSON.stringify([snapshot.contextKey, body.correction ?? '']);
      if (pendingSynthesis?.key === key) throw new ApiError(409, 'SYNTHESIS_IN_PROGRESS', 'These observations are already being connected. Wait for the current request.');
      pendingSynthesis?.controller.abort();
      ownedController = new AbortController(); pendingSynthesis = { key, controller: ownedController };
      const sequence = ++synthesisSequence;
      // A requested correction immediately withdraws the former reviewed need,
      // including when the replacement model request later fails or is cancelled.
      const previous = state.hypotheses.find(value => value.origin?.kind === 'model' && value.status === 'active');
      if (body.correction && previous) intent.feedback(previous.id, { action: 'dismiss' });
      const revision = intent.synthesisRevision();
      const controller = ownedController;
      const output = await bounded(req, res, async signal => {
        const combined = AbortSignal.any([signal, controller.signal]);
        const result = await synthesizer.synthesize(snapshot, combined, body.correction);
        if (combined.aborted) throw new ApiError(409, 'SYNTHESIS_CANCELLED', 'The context connection was cancelled. No new result was accepted.');
        return result;
      }, 'Connecting these observations took too long. Retry when you are ready.');
      if (controller.signal.aborted || sequence !== synthesisSequence || intent.synthesisRevision() !== revision) throw new ApiError(409, 'INTENT_CONTEXT_CHANGED', 'Your context or feedback changed while AI was working. Review the current observations and retry.');
      const validated = validateSynthesisOutput(output, snapshot);
      res.json(intent.saveSynthesis(snapshot.contextKey, validated, body.correction));
    } catch (error) { next(error); }
    finally { if (ownedController && pendingSynthesis?.controller === ownedController) pendingSynthesis = undefined; }
  });

  // Context-led suggestions require a reviewed need. Manual product search remains independent.
  app.post('/intent/hypotheses/:id/recommendation', async (req, res, next) => {
    try {
      const { contextKey } = z.object({ contextKey: z.string().min(1).max(2000) }).strict().parse(req.body);
      const current = () => {
        const state = intent.getState();
        if (!state.consent) throw new ApiError(409, 'INTENT_PAUSED', 'Resume context memory before showing a suggestion.');
        const hypothesis = state.hypotheses.find(item => item.id === req.params.id);
        if (!hypothesis || hypothesis.status !== 'active' || hypothesis.interest !== 'confirmed') throw new ApiError(409, 'INTENT_CONFIRMATION_REQUIRED', 'Check the possible connection before showing a product.');
        if (intentSuggestionKey(hypothesis) !== contextKey) throw new ApiError(409, 'INTENT_CONTEXT_CHANGED', 'The context changed. Review the current connection first.');
        return hypothesis;
      };
      const hypothesis = current();
      const queries: Record<Exclude<RecommendationKey, 'contextual'>, string> = {
        'portable-lunch': 'portable lunch container', 'home-meal-prep': 'food storage container',
        recording: 'microphone', 'work-calls': 'headset for work calls',
      };
      const query = hypothesis.origin?.kind === 'model' ? hypothesis.origin.productQuery : hypothesis.recommendationKey !== 'contextual' ? queries[hypothesis.recommendationKey] : undefined;
      if (!query) throw new ApiError(409, 'INTENT_CONTEXT_CHANGED', 'Review the current need before looking for a product.');
      const selection = { text: `${query}${hypothesis.constraints ? `; ${hypothesis.constraints}` : ''}`, pageTitle: 'Needle confirmed context' };
      const preferences = budgetFromInstruction(selection.text, {});
      const result = await bounded(req, res, async signal => {
        const interpretation = await providers.sample.identify(selection, signal);
        const search = await searchWithFallback('sample', interpretation, preferences, signal);
        return { sessionId: randomUUID(), mode: 'sample', interpretation, ...search, agentMode: agentAvailable(config) ? 'ai' : 'catalog' } satisfies SearchResponse;
      });
      current(); // A correction, dismissal, removal or pause during search invalidates the result.
      database.saveSession({ selection, interpretation: result.interpretation, preferences, result });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/refine', async (req, res, next) => {
    try {
      const body = refineSchema.parse(req.body);
      const session = database.session(body.sessionId);
      checkLive(session.result.mode);
      const preferences = budgetFromInstruction(body.instruction, session.preferences, body.preferences);
      const search = await bounded(req, res, signal => searchWithFallback(session.result.mode, session.interpretation, preferences, signal, body.instruction));
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
        const search = await searchWithFallback(mode, interpretation, preferences, signal);
        return { sessionId: randomUUID(), mode, interpretation, ...search, agentMode: agentAvailable(config) ? 'ai' : 'catalog' } satisfies SearchResponse;
      });
      database.saveSession({ selection, interpretation: result.interpretation, preferences, result });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post(['/orders', '/demo-orders'], (req, res, next) => {
    try {
      const body = orderSchema.parse(req.body);
      const priorCart = body.cartItemId ? database.cart().find(value => value.id === body.cartItemId) : null;
      const { order, created } = database.purchase(body);
      if (created && priorCart && !database.cart().some(value => value.offer.id === priorCart.offer.id)) cartSignal(priorCart.offer, 'remove');
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
