/** Optional backend adapter. Does not change HM/Ryan routes, intent or checkout. */
export async function decideContent(input, {baseUrl=process.env.NEEDLE_DECISION_URL||'http://127.0.0.1:4321',timeoutMs=5000}={}) {
 const response=await fetch(baseUrl+'/v1/decide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw new Error(`Decision service unavailable (${response.status}); retain existing discovery/clarification flow.`);
 return response.json();
}
export async function rankEvidence(query,candidates,{baseUrl=process.env.NEEDLE_DECISION_URL||'http://127.0.0.1:4321',timeoutMs=10000}={}) {
 const response=await fetch(baseUrl+'/v1/rank',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,candidates}),signal:AbortSignal.timeout(timeoutMs)});
 if(!response.ok)throw new Error(`Evidence ranker unavailable (${response.status}).`);
 return response.json();
}
