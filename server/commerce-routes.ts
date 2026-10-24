import { Router } from 'express';
import { z } from 'zod';
import type { CommerceSignal } from '../shared/commerce.js';
import { CommerceStore } from './commerce.js';
const id=z.string().trim().min(1).max(150);
const currency=z.string().regex(/^[A-Z]{3}$/);
const text=z.string().max(4000);
const url=z.string().url().max(5000).nullable();
const offer=z.object({id,title:text,description:text,imageUrl:url,sourceUrl:url,referenceUrl:z.string().url().max(5000).optional(),priceIsIllustrative:z.boolean().optional(),match:z.enum(['exact','likely','similar']),matchEvidence:text,price:z.number().finite().nonnegative().nullable(),currency:currency.nullable(),observedAt:z.string().max(100),dataOrigin:z.enum(['sample','retrieved']),variants:z.array(z.string().max(100)).max(100),shipping:text.nullable(),availability:text.nullable(),returns:text.nullable(),reason:text,differences:z.array(text).max(100)}).strict();
const save=z.object({id,label:z.string().trim().min(1).max(500),summary:text.optional(),sourceOrigin:z.string().url().max(5000).optional(),sourceTitle:z.string().max(500).optional(),tags:z.array(z.string().max(100)).max(50).optional(),provenance:z.enum(['observed','demo_fixture']),offer:offer.optional(),collectionId:id.optional()}).strict();
export function createCommerceRouter(store:CommerceStore,onSignal?:(signal:CommerceSignal)=>void|Promise<void>) {
 const router=Router();
 const emit=(signal:CommerceSignal)=>{try{void Promise.resolve(onSignal?.(signal)).catch(()=>{});}catch{/* Optional scoring cannot invalidate a saved action. */}};
 router.get('/saved-items',(_req,res)=>res.json({items:store.getSavedItems()}));
 router.post('/saved-items',(req,res,next)=>{try{const item=store.saveItem(save.parse(req.body));emit({type:'save',eventId:`save:${item.id}`,savedItem:item});res.json({item,items:store.getSavedItems()});}catch(error){next(error);}});
 router.post('/saved-items/:id/remove',(req,res,next)=>{try{store.removeItem(id.parse(req.params.id));res.json({items:store.getSavedItems()});}catch(error){next(error);}});
 router.get('/collections',(_req,res)=>res.json({collections:store.getCollections()}));
 router.post('/collections',(req,res,next)=>{try{const body=z.object({name:z.string().trim().min(1).max(100)}).strict().parse(req.body);res.json({collection:store.createCollection(body.name)});}catch(error){next(error);}});
 router.post('/collections/:id/items',(req,res,next)=>{try{const body=z.object({savedItemId:id}).strict().parse(req.body);res.json({collection:store.addToCollection(id.parse(req.params.id),body.savedItemId)});}catch(error){next(error);}});
 router.get('/group-buys',(_req,res)=>res.json({campaigns:store.getCampaigns()}));
 router.post('/group-buys',(req,res,next)=>{try{const body=z.object({savedItemId:id,targetParticipants:z.literal(3),targetPrice:z.number().finite().positive(),currency}).strict().parse(req.body);res.json({campaign:store.createCampaign(body.savedItemId,body.targetParticipants,body.targetPrice,body.currency)});}catch(error){next(error);}});
 router.post('/group-buys/:id/join',(req,res,next)=>{try{const body=z.object({maxPrice:z.number().finite().positive(),currency}).strict().parse(req.body);const campaign=store.join(id.parse(req.params.id),body.maxPrice,body.currency);emit({type:'group_buy_interest',eventId:`group:${campaign.id}:${campaign.revision}`,savedItem:campaign.savedItem,campaignId:campaign.id});res.json({campaign});}catch(error){next(error);}});
 router.post('/group-buys/:id/leave',(req,res,next)=>{try{const campaign=store.leave(id.parse(req.params.id));emit({type:'group_buy_withdraw',eventId:`group:${campaign.id}:${campaign.revision}`,savedItem:campaign.savedItem,campaignId:campaign.id});res.json({campaign});}catch(error){next(error);}});
 return router;
}
