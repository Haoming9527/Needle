import { randomUUID } from 'node:crypto';
import express from 'express';
import type { DiscoverRequest, SearchResponse } from '../shared/types.js';
import { agentAvailable, getConfig, missingKeys, type ServerConfig } from './config.js';
import { ApiError } from './errors.js';
import { LiveProvider } from './providers/live.js';
import { NeedleDatabase } from './storage/database.js';
import { CatalogAgentProvider } from './agent/catalog-agent.js';
import { budgetFromInstruction } from './agent/preferences.js';
import type { ProductProvider } from './providers/types.js';
import { SampleProvider } from './providers/catalog.js';
import { WebDemoProvider } from './providers/web.js';
import type { decideProducts } from './agent/product-decision.js';
import { createDiscoverySearch } from './agent/discovery.js';
import { installVoiceRoutes } from './routes/voice.js';
import { searchRecoveryQuestion } from '../shared/search-recovery.js';
import { cartItemIdSchema, cartQuantitySchema, cartSchema, clarifySchema, clearSchema, discoverSchema, orderSchema, refineSchema } from './http/schemas.js';
import { createRequestRunner, localRequestsOnly, sendApiError } from './http/lifecycle.js';

export interface AppOptions {
  config?: ServerConfig;
  sampleProvider?: ProductProvider;
  liveProvider?: ProductProvider;
  webDemoProvider?: ProductProvider;
  decisionProvider?: typeof decideProducts;
}

export function createApp(options: AppOptions = {}) {
  const config = options.config ?? getConfig();
  const app = express();
  app.disable('x-powered-by');
  const database = new NeedleDatabase(
    config.databaseFile ?? (config.orderFile ? `${config.orderFile}.sqlite` : ':memory:'),
    config.orderFile,
  );
  app.locals.database = database;
  const catalog = new SampleProvider(() => database.catalog());
  const providers = {
    sample: options.sampleProvider ?? (agentAvailable(config) ? new CatalogAgentProvider(config, catalog) : catalog),
    live: options.liveProvider ?? new LiveProvider(config),
  };
  const webDemoProvider = options.webDemoProvider ?? new WebDemoProvider(config);
  const liveMissing = missingKeys(config);
  const searchWithFallback = createDiscoverySearch({
    config,
    providers,
    webProvider: webDemoProvider,
    decide: options.decisionProvider,
    cacheWebOffers: (item, offers) => database.cacheWebOffers(item, offers),
  });
  const bounded = createRequestRunner(config.timeoutMs);

  app.use(localRequestsOnly);
  app.use(express.json({ limit: '6mb' }));
  installVoiceRoutes(app, config, database);

  function checkLive(mode: string): void {
    if (mode === 'live' && liveMissing.length) throw new ApiError(503, 'LIVE_NOT_CONFIGURED', `Live discovery needs ${liveMissing.join(' and ')} in .env. You can use the prepared catalog meanwhile.`);
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok', defaultMode: config.defaultMode, liveAvailable: !liveMissing.length, missingKeys: liveMissing, model: config.model, agentAvailable: agentAvailable(config), agentMode: agentAvailable(config) ? 'ai' : 'catalog', voiceAvailable: !!config.openAiKey, decisionAvailable: !!config.openAiKey, database: 'sqlite' }));
  app.get('/cart', (_req, res) => res.json({ items: database.cart() }));
  app.get('/orders', (_req, res) => res.json({ orders: database.history() }));
  app.post('/cart/clear', (req, res, next) => {
    try { clearSchema.parse(req.body); res.json({ items: database.clearCart() }); } catch (error) { next(error); }
  });
  app.post('/orders/clear', (req, res, next) => {
    try { clearSchema.parse(req.body); res.json({ orders: database.clearHistory() }); } catch (error) { next(error); }
  });
  app.post('/cart', (req, res, next) => {
    try { const body = cartSchema.parse(req.body); res.json({ items: database.addCart(body.sessionId, body.offerId, body.variant, body.quantity, body.operationId) }); } catch (error) { next(error); }
  });
  app.post('/cart/:id/remove', (req, res, next) => {
    try { res.json({ items: database.removeCart(cartItemIdSchema.parse(req.params.id)) }); } catch (error) { next(error); }
  });
  app.post('/cart/:id/quantity', (req, res, next) => {
    try { const { quantity } = cartQuantitySchema.parse(req.body); res.json({ items: database.quantity(cartItemIdSchema.parse(req.params.id), quantity) }); } catch (error) { next(error); }
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
      if (session.interpretation.needsClarification) throw new ApiError(409, 'QUESTION_PENDING', 'Answer the current question before refining this search. Your original selection is still available.');
      checkLive(session.result.mode);
      const preferences = budgetFromInstruction(body.instruction, session.preferences, body.preferences);
      const instructions = [...(session.instructions ?? []).slice(-4), body.instruction];
      const search = await bounded(req, res, signal => searchWithFallback(session.result.mode, session.interpretation, preferences, signal, instructions.join('\n'), session.selection));
      const result: SearchResponse = { sessionId: randomUUID(), mode: session.result.mode, interpretation: session.interpretation, ...search, agentMode: agentAvailable(config) ? 'ai' : 'catalog' };
      // Keep the original session immutable so an already-reviewed order cannot change underneath its confirmation.
      database.saveSession({ selection: session.selection, interpretation: result.interpretation, preferences, instructions, result });
      res.json(result);
    } catch (error) { next(error); }
  });

  app.post('/clarify', async (req, res, next) => {
    try {
      const body = clarifySchema.parse(req.body);
      const session = database.session(body.sessionId);
      if (!session.interpretation.needsClarification && session.result.offers.length) throw new ApiError(409, 'NO_QUESTION_PENDING', 'This item is already identified. Refine the search or select another object.');
      const mode = session.result.mode;
      checkLive(mode);
      // Images live with the browser selection, never in SQLite. Restore the saved
      // context and question so a reply cannot accidentally use a new video frame.
      const selection = {
        ...body.selection,
        ...session.selection,
        clarifications: [...(session.selection.clarifications ?? []).slice(-4), {
          question: session.interpretation.clarification || searchRecoveryQuestion(session.interpretation, session.preferences),
          answer: body.answer,
        }],
      };
      const preferences = budgetFromInstruction(body.answer, session.preferences);
      const instructions = [...(session.instructions ?? []).slice(-4), body.answer];
      const result = await bounded(req, res, async signal => {
        const interpretation = await providers[mode].identify(selection, signal);
        const search = await searchWithFallback(mode, interpretation, preferences, signal, instructions.join('\n'), selection);
        return { sessionId: randomUUID(), mode, interpretation, ...search, agentMode: agentAvailable(config) ? 'ai' : 'catalog' } satisfies SearchResponse;
      });
      database.saveSession({ selection, interpretation: result.interpretation, preferences, instructions, result });
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
  app.use(sendApiError);
  return app;
}
