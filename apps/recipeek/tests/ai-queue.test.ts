import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './database.ts';
import {handleImportQueue,runImportQueue} from '../lib/ai-import-queue.ts';
import {handleAiImport,processImportJob,advanceImport,type ImportJob} from '../lib/ai-import-service.ts';
import {extractRecipe,providerJson} from '../lib/ai-import-provider.ts';
import {applySuggestion,publicImportUrl,evidenceNumbers,validateExtraction,needsMore,type Extraction} from '../lib/ai-import-model.ts';
import {blankRecipe} from '../lib/model.ts';

const text='Pasta: 200 g pasta. Cuoci la pasta. Per 2 persone. Preparazione 5 minuti. Cottura 10 minuti.';
const evidence=(quote:string)=>({sourceId:'text-1',quote});
const draft:Extraction={classification:'recipe',title:'Pasta',description:'',servings:2,prepMinutes:5,cookMinutes:10,servingsEvidence:evidence('Per 2 persone'),prepEvidence:evidence('Preparazione 5 minuti'),cookEvidence:evidence('Cottura 10 minuti'),ingredients:[{id:'i1',name:'pasta',quantity:200,unit:'g',originalText:'200 g pasta',evidence:evidence('200 g pasta')}],steps:[{id:'s1',text:'Cuoci la pasta.',ingredientIds:['i1'],evidence:evidence('Cuoci la pasta.')}],missing:[],conflicts:[],needsVisual:false,suggestions:[]};
const env={GEMINI_API_KEY:'test-only',SUPADATA_API_KEY:'test-only',RECIPEEK_IMPORT_QUEUE_TOKEN:'queue-test-secret'};
function request(body?:unknown){return new Request('https://recipeek.test/api/ai-imports',{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});}
function model(){return Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(draft)}]}]});}

test('queue completes closed-browser imports for two owners, without duplicated model calls under concurrent ticks',async()=>{
  const {db,sqlite}=fixture();try{
    for(const owner of ['alice','bob'])await handleAiImport(request({kind:'text',text}),undefined,db,owner,env);
    let calls=0;const fetcher=(async()=>{calls++;return model();}) as typeof fetch;
    const [a,b]=await Promise.all([runImportQueue(db,env,undefined,fetcher),runImportQueue(db,env,undefined,fetcher)]);
    assert.equal(a.processed+b.processed,2);assert.equal(calls,2);
    assert.equal(sqlite.prepare("SELECT count(*) n FROM ai_imports WHERE status='ready'").get()?.n,2);
    assert.ok(sqlite.prepare("SELECT last_tick FROM ai_queue_state WHERE id='imports'").get()?.last_tick);
    await runImportQueue(db,env,undefined,fetcher);assert.equal(calls,2);
    const jobs=await (await handleAiImport(request(),undefined,db,'bob',env)).json() as ImportJob[];assert.equal(jobs.length,1);
  }finally{sqlite.close();}
});

test('queue endpoint rejects forged auth and owner overrides, and public polling cannot execute a phase',async()=>{
  const {db,sqlite}=fixture();try{
    const j=await (await handleAiImport(request({kind:'text',text}),undefined,db,'alice',env)).json() as ImportJob;
    let calls=0;const fetcher=(async()=>{calls++;return model();}) as typeof fetch;
    await handleAiImport(request({action:'advance'}),j.id,db,'alice',env,undefined,fetcher);assert.equal(calls,0);
    for(const authorization of ['', 'Bearer fake']){const r=await handleImportQueue(new Request('https://recipeek.test/internal/import-queue',{method:'POST',headers:{authorization,'oai-authenticated-user-id':'alice'}}),db,env,undefined,fetcher);assert.equal(r.status,401);}
    const get=await handleImportQueue(new Request('https://recipeek.test/internal/import-queue',{headers:{authorization:`Bearer ${env.RECIPEEK_IMPORT_QUEUE_TOKEN}`}}),db,env);assert.equal(get.status,405);
    const r=await handleImportQueue(new Request('https://recipeek.test/internal/import-queue',{method:'POST',headers:{authorization:`Bearer ${env.RECIPEEK_IMPORT_QUEUE_TOKEN}`},body:JSON.stringify({owner:'bob',url:'http://localhost'})}),db,env,undefined,fetcher);assert.equal(r.status,200);assert.equal(calls,1);
    const progress=await (await handleAiImport(new Request('https://recipeek.test/api/ai-imports/x?progress=1'),j.id,db,'alice',env)).json() as Record<string,unknown>;assert.equal(progress.status,'ready');assert.equal(progress.sources,undefined);assert.equal(progress.input,undefined);assert.equal(progress.draft,undefined);
  }finally{sqlite.close();}
});

test('queue retries polling with backoff but never starts a second paid generation after an ambiguous lease',async()=>{
  const {db,sqlite}=fixture();try{
    const base=await (await handleAiImport(request({kind:'url',url:'https://instagram.com/reel/123'}),undefined,db,'alice',env)).json() as ImportJob;
    const j={...base,status:'videoPoll',videoJob:'job-1'};
    sqlite.prepare('UPDATE ai_imports SET status=?,document=?,lease=?,lease_until=0 WHERE id=?').run(j.status,JSON.stringify(j),'expired',j.id);
    let calls=0;const failing=(async()=>{calls++;throw new Error('network unavailable');}) as typeof fetch;
    await processImportJob(db,j.id,'alice',env,undefined,failing);
    const delayed=sqlite.prepare('SELECT status,attempts,next_run_at FROM ai_imports WHERE id=?').get(j.id)!;assert.equal(delayed.status,'videoPoll');assert.equal(delayed.attempts,1);assert.ok(Number(delayed.next_run_at)>Date.now());
    await processImportJob(db,j.id,'alice',env,undefined,failing);assert.equal(calls,1);
    sqlite.prepare("UPDATE ai_imports SET status='analyze',lease='expired',lease_until=0,next_run_at=0 WHERE id=?").run(j.id);
    const stopped=await processImportJob(db,j.id,'alice',env,undefined,failing);assert.equal(stopped.job.status,'failed');assert.equal(calls,1);
  }finally{sqlite.close();}
});

test('token efficiency: equivalent text deduplicates, transcript repetition skips a model call, low thinking is explicit',async()=>{
  const {db,sqlite}=fixture();try{
    const a=await (await handleAiImport(request({kind:'text',text}),undefined,db,'alice',env)).json() as ImportJob;
    const b=await (await handleAiImport(request({kind:'text',text:text.replaceAll(' ','   ')}),undefined,db,'alice',env)).json() as ImportJob;assert.equal(a.id,b.id);
    const j:ImportJob={...a,input:{kind:'url',url:'https://instagram.com/reel/123'},draft,sources:[{id:'text-1',kind:'caption',text,label:'Descrizione'}],status:'transcript'};
    await advanceImport(j,env,db,undefined,'alice',(async()=>Response.json({content:'200 g pasta'})) as typeof fetch);assert.equal(j.status,'ready');assert.ok(j.warnings.some(w=>w.includes('un solo testo')));
    let payload:any;const result=await extractRecipe(env,j.sources,[],(async(_url:unknown,init:RequestInit)=>{payload=JSON.parse(init.body as string);return model();}) as typeof fetch);assert.equal(payload.generation_config.thinking_level,'low');assert.equal(result.usage.input,null);assert.equal(JSON.stringify(payload.input).includes('Descrizione'),false);
    const empty=await providerJson('https://provider.test',{},(async()=>new Response(null,{status:206})) as typeof fetch);assert.deepEqual(empty.data,{});
    assert.equal(publicImportUrl('https://instagram.com/reel/123?igsh=abc&utm_source=test').search,'');
    const incomplete=blankRecipe();incomplete.ingredients=[{id:'i1',name:'',quantity:null,unit:'g'}];const edited=applySuggestion(incomplete,{id:'p1',target:'i1',field:'quantity',value:'200',reason:''},'200');assert.equal(edited.ingredients[0].quantity,200);
  }finally{sqlite.close();}
});

test('mixed fractions and units are checked without escalating a complete source for model formatting mistakes',()=>{
  assert.deepEqual(evidenceNumbers('1½ tazze, ⅔ cucchiaio, 1 1/4 tazze, 0,5 l'),[1.5,2/3,1.25,0.5]);
  const changed=structuredClone(draft);changed.ingredients[0].unit='kg';
  const source=[{id:'text-1',kind:'text' as const,text,label:'Testo'}];
  assert.ok(validateExtraction(changed,source).warnings.some(w=>w.includes('unità da verificare')));
  assert.equal(needsMore(changed,source),false);
});
