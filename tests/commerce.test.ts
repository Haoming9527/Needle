import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { CommerceStore } from '../server/commerce';
import { createCommerceRouter } from '../server/commerce-routes';
import type { Offer } from '../shared/types';
const offer:Offer={id:'lunch',title:'Leakproof lunch box',description:'Portable meal prep',imageUrl:null,sourceUrl:null,match:'similar',matchEvidence:'Prepared demo',price:30,currency:'USD',observedAt:'2026-10-25',dataOrigin:'sample',variants:[],shipping:null,availability:null,returns:null,reason:'Lunch on the move',differences:[]};
const databases:DatabaseSync[]=[];afterEach(()=>{for(const db of databases.splice(0))db.close();});
function setup(now?:()=>number){const db=new DatabaseSync(':memory:');databases.push(db);const store=new CommerceStore(db,now);store.saveItem({id:'item',label:offer.title,offer,provenance:'observed'});return {db,store};}
describe('durable inspiration and group buys',()=>{
 it('persists inspirations and collections independently of discovery sessions',()=>{const dir=mkdtempSync(join(tmpdir(),'needle-commerce-'));try{let db=new DatabaseSync(join(dir,'store.sqlite'));let store=new CommerceStore(db);store.saveItem({id:'article',label:'Cycling commute',provenance:'observed'});const collection=store.createCollection('Lunch on the move');store.addToCollection(collection.id,'article');store.addToCollection(collection.id,'article');db.close();db=new DatabaseSync(join(dir,'store.sqlite'));store=new CommerceStore(db);expect(store.getSavedItems()[0].label).toBe('Cycling commute');expect(store.getCollections()[0].itemIds).toEqual(['article']);db.close();}finally{rmSync(dir,{recursive:true,force:true});}});
 it('upserts one local pledge, handles max price, and reverses readiness without orders',()=>{const {store,db}=setup();const group=store.createCampaign('item',3,25,'USD');expect(store.join(group.id,20,'USD').eligibleParticipants).toBe(2);expect(store.join(group.id,25,'USD').state).toBe('target_reached');expect(store.join(group.id,30,'USD').eligibleParticipants).toBe(3);expect(store.leave(group.id).state).toBe('open');expect(store.leave(group.id).eligibleParticipants).toBe(2);expect(db.prepare("SELECT name FROM sqlite_master WHERE name='orders'").get()).toBeUndefined();});
 it('rejects currency mismatch and expiry while retaining snapshot after item removal',()=>{let now=0;const {store}=setup(()=>now);expect(()=>store.createCampaign('item',3,20,'SGD')).toThrow();const group=store.createCampaign('item',3,25,'USD');expect(()=>store.join(group.id,25,'SGD')).toThrow();store.removeItem('item');expect(store.getCampaign(group.id).savedItem.offer?.title).toBe(offer.title);now=86400000;expect(store.getCampaign(group.id).state).toBe('expired');expect(()=>store.join(group.id,25,'USD')).toThrow();});
 it('requires a product snapshot and validates invalid prices',()=>{const {store}=setup();store.saveItem({id:'note',label:'Cycling',provenance:'demo_fixture'});expect(()=>store.createCampaign('note',3,20,'USD')).toThrow();expect(()=>store.createCampaign('item',3,-1,'USD')).toThrow();});
 it('optional scoring failures cannot fail saved commerce actions',async()=>{const {store}=setup();const app=express();app.use(express.json());app.use(createCommerceRouter(store,async()=>{throw new Error('scoring offline');}));const result=await request(app).post('/saved-items').send({id:'new',label:'Meal prep',provenance:'observed'});expect(result.status).toBe(200);expect(store.getSavedItem('new').label).toBe('Meal prep');const bad=await request(app).post('/saved-items').send({id:'bad',label:'Bad',provenance:'observed',offer:{}});expect(bad.status).toBeGreaterThanOrEqual(400);});
});
