import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {decideContent,rankEvidence} from '../decision-client.mjs';

test('decision adapter preserves target and original candidate IDs; surfaces model outage',async()=>{
 const received=[];
 const server=http.createServer(async(req,res)=>{
  let text='';for await(const chunk of req)text+=chunk;
  const body=JSON.parse(text); received.push({path:req.url,body});
  res.setHeader('Content-Type','application/json');
  if(body.text==='fail'){res.writeHead(503);res.end('{}');return;}
  res.end(JSON.stringify(req.url==='/v1/rank'?{ranking:body.candidates.map(c=>({id:c.id,score:0.5}))}:{route:'product_search',attributes:[]}));
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const options={baseUrl:`http://127.0.0.1:${server.address().port}`};
 try{
  const input={text:'A lamp appears in the background.',target:{name:'desk lamp'},sourceKind:'ocr'};
  assert.equal((await decideContent(input,options)).route,'product_search');
  assert.deepEqual(received[0],{path:'/v1/decide',body:input});
  const ranked=await rankEvidence('lamp',[{id:'offer-19',text:'desk lamp'}],options);
  assert.equal(ranked.ranking[0].id,'offer-19');
  await assert.rejects(decideContent({text:'fail'},options),/unavailable/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
