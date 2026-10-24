import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {once} from 'node:events';
test('local API persists deduplicated signals, validates input and protects ingestion',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'needle-test-'));const port=14320;
 const child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,LOGAN_PORT:String(port),LOGAN_DATA_DIR:dir,LOGAN_IMPORT_TOKEN:'test-only'}});
 try{await once(child.stdout,'data');const call=async(path,body,headers={})=>{const r=await fetch(`http://127.0.0.1:${port}${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}};
 const event={recordId:'headphones-0',attribute:'comfort',action:'convinced'};
 assert.equal((await call('/api/events',event)).data.events.length,1);assert.equal((await call('/api/events',event)).data.events.length,1);
 assert.equal((await call('/api/insights?productId=headphones')).data.totalSignals,1);
 assert.equal((await call('/api/events',{...event,recordId:'missing'})).status,400);
 assert.equal((await call('/api/import',{records:[]})).status,401);
 assert.equal((await call('/api/import',{records:[]},{Authorization:'Bearer test-only'})).status,200);
 assert.equal((await call('/api/listings',{productId:'chair',url:'javascript:alert(1)'})).status,400);
 assert.equal((await call('/api/state',null,{Origin:'https://evil.example'})).status,403);
 assert.equal((await call('/api/events',{...event,remove:true})).data.events.length,0);
 }finally{child.kill();await once(child,'exit');rmSync(dir,{recursive:true,force:true})}
});
