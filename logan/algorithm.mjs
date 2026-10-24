/** Needle HookRank v1: deterministic evidence ranking, not a purchase probability. */
export const attributes = {
 price: ['affordable','budget','value for money','worth the money','cheap','가성비','저렴','합리적','할인'],
 design: ['beautiful','minimal','sleek','aesthetic','design','예쁘','미니멀','디자인','감성'],
 convenience: ['easy to use','easy to carry','portable','lightweight','one touch','convenient','간편','휴대','가벼','편리'],
 performance: ['powerful','fast','noise cancelling','clear sound','performance','성능','빠르','노이즈 캔슬링','음질'],
 durability: ['durable','sturdy','long lasting','solid','튼튼','내구','견고'],
 comfort: ['comfortable','soft','ergonomic','comfort','편안','푹신','인체공학']
};
const normalize = s => String(s ?? '').normalize('NFKC').toLowerCase();
const tokens = s => normalize(s).match(/[\p{L}\p{N}]+/gu) ?? [];
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function extract(text) {
 const evidence = [];
 for (const sentence of normalize(text).split(/[.!?\n。]+/).filter(Boolean)) {
  for (const [attribute,phrases] of Object.entries(attributes)) for (const phrase of phrases) {
   const boundary = /^[a-z]/.test(phrase) ? '\\b' : '';
   const matches = [...sentence.matchAll(new RegExp(boundary + escape(phrase) + boundary,'gu'))];
   for (const hit of matches) {
    const before = sentence.slice(Math.max(0,hit.index-35),hit.index);
    const after = sentence.slice(hit.index+phrase.length,hit.index+phrase.length+15);
    const negated = /(?:\bnot\b|\bnever\b|\bisn't\b|\bwasn't\b|\bno\b)(?:\s+\w+){0,2}\s*$/.test(before) || /(?:안\s*|못\s*)$/.test(before) || /^(?:하지|하지는|하지도|지|지는|지도)?\s*(?:않|못)/.test(after);
    evidence.push({attribute,phrase,polarity:negated?-1:1,sentence:sentence.trim().slice(0,500)});
   }
  }
 }
 const scores = Object.fromEntries(Object.keys(attributes).map(a=>{
  const e = evidence.filter(e=>e.attribute===a);
  const positive = new Set(e.filter(e=>e.polarity>0).map(e=>e.phrase)).size;
  const negative = new Set(e.filter(e=>e.polarity<0).map(e=>e.phrase)).size;
  return [a,Math.max(0,(positive-negative)/(1+positive+negative))];
 }));
 return {scores,evidence};
}
export function rank(records,{query='',weights={},productId}={}) {
 const seen = new Set();
 const docs = records.filter(r=>!productId||r.productId===productId).filter(r=>{
  const key = r.productId+'|'+normalize(r.text).replace(/\s+/g,' ').trim();
  if(seen.has(key)) return false; seen.add(key); return true;
 });
 const terms = docs.map(r=>tokens(r.title+' '+r.text));
 const q = [...new Set(tokens(query))];
 const avg = terms.reduce((n,t)=>n+t.length,0)/(terms.length||1)||1;
 const active = Object.entries(weights).filter(([k,v])=>k in attributes&&Number.isFinite(v)&&v>0).map(([k,v])=>[k,Math.min(v,5)]);
 const totalWeight = active.reduce((n,[,v])=>n+v,0);
 const out = docs.map((r,i)=>{
  let bm25=0;
  for(const t of q){ const tf=terms[i].filter(x=>x===t).length; const df=terms.filter(d=>d.includes(t)).length;
   bm25+=Math.log(1+(docs.length-df+.5)/(df+.5))*tf*2.2/(tf+1.2*(.25+.75*terms[i].length/avg));
  }
  const {scores,evidence}=extract(r.text);
  const affinity=totalWeight?active.reduce((n,[k,v])=>n+v*scores[k],0)/totalWeight:0;
  return {...r,components:{bm25,affinity},attributes:scores,evidence};
 });
 const max=Math.max(1e-9,...out.map(r=>r.components.bm25));
 return out.map(r=>({...r,score:Math.round(100*(q.length?(totalWeight ? .65 : 1)*r.components.bm25/max:0)+(totalWeight?(q.length?35:100)*r.components.affinity:0))})).filter(r=>!q.length||r.components.bm25>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
/** Adapter for the team's shared/types.ts SearchResponse. No product descriptions are called reviews. */
export function fromSearchResponse(response){
 return (response.offers??[]).map(o=>({id:o.id,productId:o.id,title:o.title,text:[o.description,o.matchEvidence,o.reason,...(o.differences??[])].filter(Boolean).join('. '),platform:'Product listing',creator:null,url:o.sourceUrl??o.referenceUrl??null,kind:'listing',origin:o.dataOrigin,price:o.price,currency:o.currency,priceIsIllustrative:o.priceIsIllustrative===true}));
}
