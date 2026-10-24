import { Router } from 'express';
import { z } from 'zod';
import { intentActions, intentTags } from '../shared/intent.js';
import { ATTENTION_DWELL_MS } from '../shared/attention.js';
import { IntentStore } from './intent.js';

const id = z.string().min(1).max(100);
const observation = z.object({
  id, action: z.enum(intentActions), sourceOrigin: z.string().max(500).url().refine(value => {
    const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  }, 'Use a public page origin.'),
  sourceTitle: z.string().trim().max(200), summary: z.string().trim().min(1).max(500),
  tags: z.array(z.enum(intentTags)).max(6), provenance: z.enum(['observed', 'demo_fixture']),
  entityKey: z.string().trim().min(1).max(200).optional(), collectionId: id.optional(),
}).strict();
const attention = z.object({
  id: z.string().uuid(), sessionId: z.string().uuid(), pageInstanceId: z.string().uuid(),
  sourceId: z.enum(['recipe-guide', 'commute-guide']), targetId: z.string().min(1).max(100),
  action: z.enum(['dwell', 'revisit']),
  measurement: z.object({ dwellMs: z.number().int().min(ATTENTION_DWELL_MS).max(3_600_000), visitOrdinal: z.number().int().min(1).max(10000) }).strict(),
  capturedAt: z.string().datetime({ offset: true }), documentUrl: z.string().url().max(2000),
}).strict().refine(value => value.action !== 'revisit' || value.measurement.visitOrdinal >= 2, 'A revisit requires a return visit.');
export function createIntentRouter(store: IntentStore): Router {
  const router = Router();
  router.post('/intent/attention/consent', (req, res, next) => { try { res.json(store.setAttentionConsent(z.object({ enabled: z.boolean() }).strict().parse(req.body).enabled)); } catch (error) { next(error); } });
  router.post('/intent/attention', (req, res, next) => { try { res.json(store.recordAttention(attention.parse(req.body))); } catch (error) { next(error); } });
  router.get('/intent', (_req, res) => res.json(store.getState()));
  router.post('/intent/consent', (req, res, next) => { try { res.json(store.setConsent(z.object({ enabled: z.boolean() }).strict().parse(req.body).enabled)); } catch (error) { next(error); } });
  router.post('/intent/observations', (req, res, next) => { try { res.json(store.record(observation.parse(req.body))); } catch (error) { next(error); } });
  router.post('/intent/observations/:id/remove', (req, res, next) => { try { res.json(store.remove(id.parse(req.params.id))); } catch (error) { next(error); } });
  router.post('/intent/hypotheses/:id/feedback', (req, res, next) => {
    try {
      const body = z.object({ action: z.enum(['confirm', 'dismiss', 'correct']), correction: z.enum(['home-meal-prep', 'work-calls']).optional(), constraints: z.string().trim().max(500).optional() }).strict().parse(req.body);
      res.json(store.feedback(id.parse(req.params.id), body));
    } catch (error) { next(error); }
  });
  router.post('/intent/reset', (req, res, next) => { try { z.object({}).strict().parse(req.body); res.json(store.reset()); } catch (error) { next(error); } });
  return router;
}
