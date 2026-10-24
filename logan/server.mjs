import http from 'node:http';
import {decideContent} from './decision-client.mjs';
import {readFileSync,mkdirSync,existsSync,writeFileSync,renameSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {rank,fromSearchResponse,attributes} from './algorithm.mjs';
import {products,records as sampleRecords} from './sample.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.LOGAN_PORT||4320);
const dir=process.env.LOGAN_DATA_DIR||join(root,'data'); mkdirSync(dir,{recursive:true});
const file=join(dir,'workspace.json');
let state=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{events:[],listings:[],records:[]};
const save=()=>{writeFileSync(file+'.tmp',JSON.stringify(state));renameSync(file+'.tmp',file)};
const all=()=>[...sampleRecords,...state.records];
const safeUrl=s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
function feed(productId){
 const events=state.events.filter(e=>!productId||e.productId===productId);
 const counts=key=>Object.fromEntries([...new Set(events.map(e=>e[key]).filter(Boolean))].map(k=>[k,events.filter(e=>e[key]===k).length]));
 return {schema_version:'logan.v1',scope:'single-local-workspace',generated_at:new Date().toISOString(),productId:productId||null,totalSignals:events.length,actions:counts('action'),reasons:counts('attribute'),platforms:counts('platform'),notice:'Self-reported interest, not purchases or conversion. Sample content and imported content are labeled separately.',origins:counts('origin')};
}
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>1000000)throw Error('BODY_TOO_LARGE')}return JSON.parse(s||'{}')}
const server=http.createServer(async(req,res)=>{
 const send=(n,x)=>{res.writeHead(n,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(x))};
 try{
  const host=req.headers.host;
  if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host))return send(403,{error:'LOCAL_ONLY'});
  if(req.headers.origin&&!['http://'+host].includes(req.headers.origin))return send(403,{error:'ORIGIN_DENIED'});
  res.setHeader('X-Content-Type-Options','nosniff');
  const u=new URL(req.url,'http://'+host);
  if(req.method==='GET'&&u.pathname==='/api/state')return send(200,{products,records:all(),events:state.events,listings:state.listings,feed:feed()});
  if(req.method==='GET'&&u.pathname==='/api/insights')return send(200,feed(u.searchParams.get('productId')));
  if(req.method==='POST'){
   if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON_REQUIRED'});
   const b=await body(req);
   if(u.pathname==='/api/decision'){
    try{return send(200,await decideContent(b));}catch{return send(503,{error:'DECISION_SERVICE_UNAVAILABLE',detail:'Start the local learned model service on port 4321.'});}
   }
   if(u.pathname==='/api/rank'){
    if(typeof b.query!=='string'||b.query.length>1000||!b.weights||typeof b.weights!=='object')return send(400,{error:'INVALID_QUERY'});
    return send(200,{results:rank(all(),b),algorithm:'Needle HookRank v1'});
   }
   if(u.pathname==='/api/discover'){
    if(typeof b.query!=='string'||!b.query.trim()||b.query.length>1000)return send(400,{error:'INVALID_QUERY'});
    const upstream=process.env.NEEDLE_API_URL||'http://127.0.0.1:4318';
    let response;
    try{response=await fetch(upstream+'/discover',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({selection:{text:b.query},mode:b.mode==='live'?'live':'sample'}),signal:AbortSignal.timeout(45000)})}catch{return send(503,{error:'TEAM_API_UNAVAILABLE'})}
    const data=await response.json();
    if(!response.ok)return send(response.status,{error:'TEAM_API_ERROR',detail:data.error?.message||'Search failed'});
    return send(200,{...data,ranked:rank(fromSearchResponse(data),{query:'',weights:b.weights??{}})});
   }
   if(u.pathname==='/api/events'){
    const record=all().find(r=>r.id===b.recordId);
    if(!record||!['convinced','group_interest','buy_intent','explore'].includes(b.action)||!(b.attribute in attributes))return send(400,{error:'INVALID_EVENT'});
    const e={recordId:record.id,productId:record.productId,platform:record.platform,origin:record.origin,attribute:b.attribute,action:b.action,at:new Date().toISOString()};
    const existing=state.events.findIndex(x=>x.recordId===e.recordId&&x.action===e.action);
    if(b.remove)state.events=state.events.filter(x=>!(x.recordId===e.recordId&&x.action===e.action));
    else if(existing>=0)state.events[existing]=e;else state.events.push(e);
    save();return send(200,{events:state.events,feed:feed()});
   }
   if(u.pathname==='/api/listings'){
    if(!products.some(p=>p.id===b.productId)||!safeUrl(b.url))return send(400,{error:'INVALID_LISTING'});
    state.listings=state.listings.filter(l=>l.productId!==b.productId);
    if(!b.remove)state.listings.push({productId:b.productId,url:safeUrl(b.url)});
    save();return send(200,{listings:state.listings});
   }
   if(u.pathname==='/api/import'){
    // Team ingestion adapter. The collector remains owned by HM/Ryan.
    if(!process.env.LOGAN_IMPORT_TOKEN||req.headers.authorization!==`Bearer ${process.env.LOGAN_IMPORT_TOKEN}`)return send(401,{error:'IMPORT_TOKEN_REQUIRED'});
    if(!Array.isArray(b.records)||b.records.length>200)return send(400,{error:'INVALID_RECORDS'});
    const clean=[];
    for(const r of b.records){
     if(!r||typeof r.id!=='string'||!/^team-[a-zA-Z0-9_-]{1,100}$/.test(r.id)||typeof r.productId!=='string'||typeof r.text!=='string'||!r.text.trim()||r.text.length>20000||typeof r.title!=='string'||r.title.length>300||!safeUrl(r.url)||!['review','listing'].includes(r.kind))return send(400,{error:'INVALID_RECORD'});
     clean.push({id:r.id,productId:r.productId,title:r.title,text:r.text,url:safeUrl(r.url),platform:String(r.platform||'Other').slice(0,60),creator:String(r.creator||'').slice(0,100),kind:r.kind,origin:'imported'});
    }
    const map=new Map(state.records.map(r=>[r.id,r]));for(const r of clean)map.set(r.id,r);state.records=[...map.values()];save();return send(200,{imported:clean.length});
   }
   return send(404,{error:'NOT_FOUND'});
  }
  if(req.method!=='GET')return send(405,{error:'METHOD_NOT_ALLOWED'});
  const path=u.pathname==='/'?'/index.html':u.pathname;
  const allowed=new Map([['/index.html','text/html; charset=utf-8'],['/app.js','text/javascript'],['/style.css','text/css'],...['headphones','chair','tent','laptop'].map(x=>['/assets/'+x+'.svg','image/svg+xml'])]);
  if(!allowed.has(path))return send(404,{error:'NOT_FOUND'});
  res.writeHead(200,{'Content-Type':allowed.get(path)});res.end(readFileSync(join(root,'public',path)));
 }catch(error){send(400,{error:error.message==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'INVALID_REQUEST'})}
});
server.listen(port,'127.0.0.1',()=>console.log(`Needle · Logan http://127.0.0.1:${port}`));
