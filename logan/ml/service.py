"""Loopback-only learned routing service; accepts upstream text, never raw media."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from collections import OrderedDict
from pathlib import Path
import argparse,hashlib,json,threading,time

class Service:
 def __init__(self,model):self.model=model;self.cache=OrderedDict();self.lock=threading.Lock()
 def decide(self,body):
  text=body.get('text');target=body.get('target',{})
  if not isinstance(text,str) or not text.strip() or len(text)>12000:raise ValueError('text must contain 1..12000 characters of extracted evidence')
  if not isinstance(target,dict) or not isinstance(target.get('name',''),str):raise ValueError('target must be an object with name')
  if len(target.get('name',''))>300:raise ValueError('target name too long')
  if body.get('sourceKind','text') not in ['text','transcript','ocr','vision_description']:raise ValueError('upstream transcription/OCR/vision text required; raw media not supported')
  start=time.perf_counter();key=hashlib.sha256(json.dumps([text,target.get('name','')],ensure_ascii=False).encode()).hexdigest()
  with self.lock:
   hit=key in self.cache
   if hit:result=dict(self.cache[key]);self.cache.move_to_end(key)
   else:
    result=self.model.route(text,target.get('name',''))
    # Missing target never bypasses HM's clarification step.
    if not target.get('name','').strip():
     result={**result,'route':'clarify','abstained':True,'attributes':[],'clarification_reason':'missing_target'}
    if result.get('truncated'):
     result={**result,'route':'clarify','abstained':True,'attributes':[],'clarification_reason':'input_exceeds_model_context'}
    self.cache[key]=result
    while len(self.cache)>128:self.cache.popitem(last=False)
  route=result['route'];result=dict(result)
  result['next_action']={'review_analysis':'analyze_target_review_evidence','product_search':'call_existing_needle_discover','clarify':'request_target_or_better_capture'}[route]
  result['sourceKind']=body.get('sourceKind','text');result['requestId']=str(body.get('requestId',''))[:100]
  result['cache_hit']=hit;result['service_elapsed_ms']=round((time.perf_counter()-start)*1000,3)
  result['limitations']=['Synthetic-data head fine-tuning; no measured real-user retention lift.','Text-only: extraction and visual identity are upstream team responsibilities.','No product endorsement inferred for incidental appearances.']
  return result

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=4321);parser.add_argument('--device',default=None);parser.add_argument('--backend',choices=['small','clm'],default='small');args=parser.parse_args()
 if args.backend=='clm':
  from clm_model import NeedleCLMModel
  model=NeedleCLMModel()
  model_info={'model':'needle-clm-partial-head-v1' if model.tuned else 'clm-original-heads-qwen3-4bit','device':'mlx','training':'final projection layers only; frozen Qwen3-8B 4bit' if model.tuned else 'released CLM heads; no task fine-tuning applied','tuned_head_promoted':model.tuned,'attributes_available':False,'ranking_available':False}
 else:
  from small_model import NeedleSmallModel
  model=NeedleSmallModel(device=args.device)
  model_info={'model':'needle-small-decision-v1','device':model.encoder.device,'training':'fitted heads on frozen E5; not CLM-8B','attributes_available':True,'ranking_available':True}
 service=Service(model)
 class Handler(BaseHTTPRequestHandler):
  def log_message(self,*args):pass
  def send(self,status,value):
   data=json.dumps(value,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
  def allowed(self):
   host=self.headers.get('Host','');origin=self.headers.get('Origin');return host in [f'localhost:{args.port}',f'127.0.0.1:{args.port}'] and (not origin or origin=='http://'+host)
  def do_GET(self):
   if not self.allowed():return self.send(403,{'error':'LOCAL_ONLY'})
   if self.path!='/health':return self.send(404,{'error':'NOT_FOUND'})
   self.send(200,{'status':'ok',**model_info,'routes':['review_analysis','product_search','clarify']})
  def do_POST(self):
   if not self.allowed():return self.send(403,{'error':'LOCAL_ONLY'})
   if not self.headers.get('Content-Type','').startswith('application/json'):return self.send(415,{'error':'JSON_REQUIRED'})
   try:
    size=int(self.headers.get('Content-Length','0'))
    if not 0<size<=64000:return self.send(413,{'error':'INVALID_BODY_SIZE'})
    body=json.loads(self.rfile.read(size))
    if not isinstance(body,dict):raise ValueError('object required')
    if self.path=='/v1/decide':return self.send(200,service.decide(body))
    if self.path=='/v1/rank':
     if args.backend=='clm':return self.send(501,{'error':'RANKING_UNAVAILABLE','detail':'CLM provides route decisions only. Use the small backend for semantic ranking.'})
     query=body.get('query');candidates=body.get('candidates')
     if not isinstance(query,str) or not query.strip() or len(query)>2000 or not isinstance(candidates,list) or len(candidates)>50:raise ValueError('query and up to 50 candidates required')
     ids=[]
     for c in candidates:
      if not isinstance(c,dict) or not isinstance(c.get('id'),str) or any(not isinstance(c.get(k,''),str) or len(c.get(k,''))>12000 for k in ['title','text','description']):raise ValueError('invalid candidate')
      ids.append(c['id'])
     if len(ids)!=len(set(ids)):raise ValueError('candidate IDs must be unique')
     with service.lock:r=model.rank(query,candidates)
     return self.send(200,{'ranking':r,'model':'multilingual-e5-small','fine_tuned_retrieval':False,'warning':'Relevance only; preserve identity match tier, prices and original offer IDs.'})
    self.send(404,{'error':'NOT_FOUND'})
   except (ValueError,TypeError,json.JSONDecodeError) as e:self.send(400,{'error':'INVALID_REQUEST','detail':str(e)[:200]})
   except Exception:self.send(503,{'error':'MODEL_FAILED','fallback':'Keep existing result; do not fabricate a learned decision.'})
 ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
if __name__=='__main__':main()
