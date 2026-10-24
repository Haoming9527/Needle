"""Exercise the actual HTTP policy after weights are frozen; no retraining."""
import json,urllib.request,urllib.error,time
from pathlib import Path
import numpy as np
from sklearn.metrics import accuracy_score,f1_score,confusion_matrix
ROOT=Path(__file__).parent
rows=[json.loads(x) for x in (ROOT/'data/eval_handwritten.jsonl').read_text().splitlines()]
def request(body,path='/v1/decide'):
 req=urllib.request.Request('http://127.0.0.1:4321'+path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
 start=time.perf_counter()
 with urllib.request.urlopen(req,timeout=20) as r:j=json.load(r)
 return j,(time.perf_counter()-start)*1000
pred=[];latencies=[];cachehits=0;perlang={};examples=[]
for r in rows:
 j,ms=request({'text':r['text'],'target':{'name':r['product']},'sourceKind':'transcript','requestId':r['id']})
 pred.append(j['route']);latencies.append(ms);cachehits+=j['cache_hit'];perlang.setdefault(r['language'],[]).append(ms)
 if len(examples)<3:examples.append({'id':r['id'],'expected':r['label'],'route':j['route'],'elapsed_ms':ms})
y=[r['label'] for r in rows]
health=json.load(urllib.request.urlopen('http://127.0.0.1:4321/health'))
missing,_=request({'text':'A beautiful product review.','target':{}});assert missing['route']=='clarify'
rank,_=request({'query':'portable headphones','candidates':[{'id':'a','text':'wireless headphones for travel'},{'id':'b','text':'kitchen sink plumbing'}]},'/v1/rank');assert {x['id'] for x in rank['ranking']}=={'a','b'}
try:request({'text':'x','target':'bad'});raise AssertionError('invalid request accepted')
except urllib.error.HTTPError as e:assert e.code==400
report={'scope':'60 synthetic held-out rows through deployed HTTP service incl target/truncation policy and attribute extraction; no training changes','health':health,'n':len(rows),'accuracy':accuracy_score(y,pred),'macro_f1':f1_score(y,pred,average='macro'),'labels':['review_analysis','product_search','clarify'],'confusion_matrix':confusion_matrix(y,pred,labels=['review_analysis','product_search','clarify']).tolist(),'http_inference_p50_ms':float(np.median(latencies)),'http_inference_p95_ms':float(np.percentile(latencies,95)),'cache_hits':cachehits,'language_latency':{k:{'n':len(v),'p50_ms':float(np.median(v)),'p95_ms':float(np.percentile(v,95))} for k,v in perlang.items()},'contract_checks':['missing target -> clarify','invalid target -> 400','rank preserves original IDs'],'examples':examples}
p=ROOT/'reports/service_evaluation.json'
if p.exists():raise RuntimeError('Refusing overwrite of evaluation report')
p.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
