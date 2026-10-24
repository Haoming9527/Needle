import { Router } from 'express';
import { z } from 'zod';
import { intentActions, intentTags } from '../shared/intent.js';
import { IntentStore } from './intent.js';

const id = z.string().min(1).max(100);
const observation = z.object({
  id, action: z.enum(intentActions), sourceOrigin: z.string().max(500).url().refine(value => {
    const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  }, 'Use a public page origin.'),
  sourceTitle: z.string().trim().max(200), summary: z.string().trim().min(1).max(500),
  tags: z.array(z.enum(intentTags)).min(1).max(6), provenance: z.enum(['observed', 'demo_fixture']),
  entityKey: z.string().trim().min(1).max(200).optional(), collectionId: id.optional(),
}).strict();
export function createIntentRouter(store: IntentStore): Router {
  const router = Router();
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
