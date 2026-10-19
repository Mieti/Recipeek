import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './database.ts';
import {handleAiImport,processImportJob,type ImportJob} from '../lib/ai-import-service.ts';
import {runImportQueue} from '../lib/ai-import-queue.ts';
const env={GEMINI_API_KEY:'test'};
const request=(body:unknown)=>new Request('https://recipeek.test/api/ai-imports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const draft={classification:'recipe',title:'Pasta',description:'',servings:2,servingsEvidence:{sourceId:'photo-1',quote:'Per 2 persone'},prepMinutes:null,cookMinutes:null,prepEvidence:null,cookEvidence:null,ingredients:[{id:'i1',name:'pasta',quantity:200,unit:'g',originalText:'200 g pasta',evidence:{sourceId:'photo-1',quote:'200 g pasta'}}],steps:[{id:'s1',text:'Cuoci la pasta.',ingredientIds:['i1'],evidence:{sourceId:'photo-1',quote:'Cuoci la pasta'}}],missing:[],conflicts:[],needsVisual:false,suggestions:[]};

test('photos bypass short kickoff, get a longer timeout and lease, and keep historical uncertain charges',async()=>{
 const {db,sqlite}=fixture();const originalTimeout=AbortSignal.timeout;try{
  const bytes=new Uint8Array(readFileSync(new URL('./fixtures/photo.jpeg',import.meta.url)));
  sqlite.prepare("INSERT INTO uploads (id,owner_id,name,content_type,created_at,byte_size,state) VALUES ('photo','alice','Pagina','image/jpeg','2026',?,'ready')").run(bytes.length);
  const bucket={get:async()=>({size:bytes.length,arrayBuffer:async()=>bytes.buffer})} as unknown as R2Bucket;
  sqlite.prepare("INSERT INTO ai_import_budget VALUES ('old','old-job','alice','gemini',?,3000000,0,'2026')").run(new Date().toISOString().slice(0,7));
  const j=await (await handleAiImport(request({kind:'photos',photos:['/api/media/photo']}),undefined,db,'alice',env,bucket)).json() as ImportJob;
  let calls=0;
  const fetcher=(async(_url:any,init:RequestInit)=>{
   calls++;const body=JSON.parse(init.body as string);assert.equal(body.background,undefined);assert.equal(body.store,false);
   const lease=sqlite.prepare('SELECT lease_until FROM ai_imports WHERE id=?').get(j.id) as any;assert.ok(lease.lease_until>Date.now()+80000);
   const duplicate=await processImportJob(db,j.id,'alice',env,bucket,fetcher);assert.equal(duplicate.processed,false);
   return Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(draft)}]}],usage:{total_input_tokens:1560,total_output_tokens:1288,total_thought_tokens:0}});
  }) as typeof fetch;
  await runImportQueue(db,env,bucket,fetcher,false);assert.equal(calls,0);
  await assert.rejects(handleAiImport(request({action:'continue'}),j.id,db,'bob',env,bucket,fetcher),/non trovata/);
  let timeout=0;AbortSignal.timeout=(ms:number)=>{timeout=ms;return originalTimeout(ms);};
  await runImportQueue(db,env,bucket,fetcher);assert.equal(timeout,50000);assert.equal(calls,1);
  assert.equal(sqlite.prepare('SELECT status FROM ai_imports WHERE id=?').get(j.id)?.status,'ready');
  assert.equal(sqlite.prepare("SELECT charge FROM ai_import_budget WHERE id='old'").get()?.charge,3000000);
  const charged=sqlite.prepare("SELECT charge,known FROM ai_import_budget WHERE id<>'old'").all();assert.equal(charged.length,1);assert.equal(charged[0].known,1);assert.equal(charged[0].charge,6000);
 }finally{AbortSignal.timeout=originalTimeout;sqlite.close();}
});

test('timeout is explained, retains uncertainty and never auto-repeats a paid generation',async()=>{
 const {db,sqlite}=fixture();try{
  const j=await (await handleAiImport(request({kind:'text',text:'Pasta per due persone: cuoci 200 g pasta.'}),undefined,db,'alice',env)).json() as ImportJob;
  let calls=0;const fetcher=(async()=>{calls++;throw new DOMException('Timed out','TimeoutError');}) as typeof fetch;
  const first=await processImportJob(db,j.id,'alice',env,undefined,fetcher);assert.equal(first.job.status,'failed');assert.match(first.job.error!,/tempo disponibile/);
  await processImportJob(db,j.id,'alice',env,undefined,fetcher);assert.equal(calls,1);
  const charge=sqlite.prepare('SELECT charge,known FROM ai_import_budget').get();assert.equal(charge?.charge,500000);assert.equal(charge?.known,0);
 }finally{sqlite.close();}
});
