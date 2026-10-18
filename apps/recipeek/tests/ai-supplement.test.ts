import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './database.ts';
import {handleApi} from '../lib/api-handler.ts';
import {handleAiImport,processImportJob,type ImportJob} from '../lib/ai-import-service.ts';
import {guardExtraction,recipeFromExtraction,type Extraction} from '../lib/ai-import-model.ts';
import {integrateExtraction} from '../lib/ai-import-merge.ts';
import {cleanupUploads} from '../lib/media-storage.ts';
import {importMetrics} from '../lib/ai-import-metrics.ts';

const env={GEMINI_API_KEY:'fixture',SUPADATA_API_KEY:'fixture',RECIPEEK_IMPORT_ADMIN_PROFILES:'alice'};
const text='Pasta al pomodoro: 200 g pasta e 100 g pomodoro. Per 2 persone.';
const ev=(quote:string,sourceId='text-1')=>({sourceId,quote});
const base:Extraction={classification:'partial_recipe',title:'Pasta al pomodoro',description:'',servings:2,servingsEvidence:ev('Per 2 persone'),prepMinutes:null,prepEvidence:null,cookMinutes:null,cookEvidence:null,ingredients:[{id:'i1',name:'pasta',quantity:200,unit:'g',originalText:'200 g pasta',evidence:ev('200 g pasta')},{id:'i2',name:'pomodoro',quantity:100,unit:'g',originalText:'100 g pomodoro',evidence:ev('100 g pomodoro')}],steps:[],missing:['Procedimento assente'],conflicts:[],needsVisual:false,suggestions:[]};
const extra='Cuoci la pasta per 10 minuti, poi uniscila al pomodoro.';
const next:Extraction={...structuredClone(base),classification:'recipe',missing:[],steps:[{id:'s1',text:extra,ingredientIds:['i1','i2'],evidence:ev(extra,'text-extra-1')}],cookMinutes:10,cookEvidence:ev('10 minuti','text-extra-1')};
const request=(body?:unknown,id='')=>new Request('https://recipeek.test/api/ai-imports'+(id?'/'+id:''),{method:body?'POST':'GET',headers:{'content-type':'application/json',origin:'https://recipeek.test'},body:body?JSON.stringify(body):undefined});
const model=(d:Extraction)=>(async()=>Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(d)}]}],usage:{total_input_tokens:500,total_output_tokens:200,total_thought_tokens:0}})) as typeof fetch;
async function initial(db:ReturnType<typeof fixture>['db']){const created=await (await handleAiImport(request({kind:'text',text}),undefined,db,'alice',env)).json() as ImportJob;return (await processImportJob(db,created.id,'alice',env,undefined,model(base))).job;}
const read=async(db:ReturnType<typeof fixture>['db'],id:string)=>(await (await handleAiImport(request(),id,db,'alice',env)).json()) as ImportJob;

test('same draft enrichment preserves edits, waits for explicit integration, respects revisions and saves privately',async()=>{
  const {db,sqlite}=fixture();try{
    let j=await initial(db);const edited={...recipeFromExtraction(base),title:'La mia pasta',notes:'Promemoria personale'};edited.ingredients[0].quantity=250;
    j=await (await handleAiImport(request({action:'review',revision:j.reviewRevision,recipe:edited}),j.id,db,'alice',env)).json() as ImportJob;
    const body={action:'supplement',revision:j.reviewRevision,input:{kind:'text',text:extra},confirmCost:true};
    await assert.rejects(()=>handleAiImport(request(body),j.id,db,'bob',env),/non trovata/);
    const [one,two]=await Promise.allSettled([handleAiImport(request(body),j.id,db,'alice',env),handleAiImport(request(body),j.id,db,'alice',env)]);assert.equal([one,two].filter(v=>v.status==='fulfilled').length,1);
    j=(await processImportJob(db,j.id,'alice',env,undefined,model(next))).job;assert.ok(j.candidate);assert.equal((j.review as any).recipe.title,'La mia pasta');assert.equal(j.draft?.steps.length,0);
    await assert.rejects(()=>handleAiImport(request({action:'save',revision:j.reviewRevision,recipe:recipeFromExtraction(next),reviewed:true,servingsConfirmed:true}),j.id,db,'alice',env),/nuova analisi/);
    j=await (await handleAiImport(request({action:'acceptCandidate',revision:j.reviewRevision}),j.id,db,'alice',env)).json() as ImportJob;
    const recipe=(j.review as any).recipe;assert.equal(recipe.title,'La mia pasta');assert.equal(recipe.notes,'Promemoria personale');assert.equal(recipe.ingredients[0].quantity,250);assert.equal(recipe.steps.length,1);assert.equal(recipe.cookMinutes,10);assert.equal(j.candidate,undefined);
    const saved=await (await handleAiImport(request({action:'save',revision:j.reviewRevision,recipe,decisions:[],reviewed:true,servingsConfirmed:true}),j.id,db,'alice',env)).json() as ImportJob;assert.equal(saved.status,'saved');assert.equal(sqlite.prepare('SELECT visibility FROM recipes').get()?.visibility,'private');
  }finally{sqlite.close();}
});

test('integration remaps reordered IDs, preserves removed ingredients, existing procedure and manual fields',()=>{
  const before=structuredClone(next),current=recipeFromExtraction(before);current.steps[0].text='Cuoci come preferisci.';current.ingredients=current.ingredients.filter(i=>i.id!=='i2');current.ingredients[0].name='Pasta integrale';current.prepMinutes=7;
  const reordered=structuredClone(next);reordered.ingredients.reverse();reordered.ingredients[0].id='i1';reordered.ingredients[1].id='i2';reordered.steps[0].text='Procedimento riscritto dal modello';reordered.prepMinutes=3;
  const result=integrateExtraction(before,reordered,current);assert.equal(result.recipe.ingredients.length,1);assert.equal(result.recipe.ingredients[0].name,'Pasta integrale');assert.equal(result.recipe.steps[0].text,'Cuoci come preferisci.');assert.equal(result.recipe.prepMinutes,7);assert.equal(new Set(result.draft.ingredients.map(i=>i.id)).size,2);
});

test('integration never turns q.b. into a measured dose or fills an amount with an incompatible unit',()=>{
  const before=structuredClone(base);before.ingredients[0].quantity=null;before.ingredients[0].originalText='pasta q.b.';
  let current=recipeFromExtraction(before),candidate=structuredClone(next);candidate.ingredients[0].quantity=20;
  assert.equal(integrateExtraction(before,candidate,current).recipe.ingredients[0].quantity,null);
  before.ingredients[0].originalText='pasta';current=recipeFromExtraction(before);candidate.ingredients[0].unit='ml';
  assert.equal(integrateExtraction(before,candidate,current).recipe.ingredients[0].quantity,null);
});

test('non-recipe and unsupported generations fail closed and cannot be deepened or rescued with unrelated text',async()=>{
  const {db,sqlite}=fixture();try{
    const source=[{id:'text-1',kind:'text' as const,text:'Notizie sul campionato di calcio.',label:'Testo'}];
    const guarded=guardExtraction(next,source);assert.equal(guarded.classification,'insufficient_content');assert.deepEqual(guarded.ingredients,[]);assert.deepEqual(guarded.suggestions,[]);
    const non={...structuredClone(next),classification:'not_recipe' as const};assert.deepEqual(guardExtraction(non,source).steps,[]);
    let j=await initial(db);const unrelated={...j,draft:guardExtraction(non,source),input:{kind:'url',url:'https://youtube.com/watch?v=nonrecipe'},duration:30};sqlite.prepare('UPDATE ai_imports SET document=? WHERE id=?').run(JSON.stringify(unrelated),j.id);
    await assert.rejects(()=>handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'text',text:extra},confirmCost:true}),j.id,db,'alice',env),/non è una ricetta/);
    await assert.rejects(()=>handleAiImport(request({action:'deepen',revision:j.reviewRevision}),j.id,db,'alice',{...env,RECIPEEK_IMPORT_VIDEO:'true'}),/non disponibile/);
  }finally{sqlite.close();}
});

test('irrelevant or failed supplemental analysis keeps the prior review; duplicate and unconfirmed text causes no work',async()=>{
  const {db,sqlite}=fixture();try{
    let j=await initial(db);
    await assert.rejects(()=>handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'text',text:extra}}),j.id,db,'alice',env),/conferma/);
    await assert.rejects(()=>handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'text',text},confirmCost:true}),j.id,db,'alice',env),/già presente/);
    await handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'text',text:extra},confirmCost:true}),j.id,db,'alice',env);
    j=(await processImportJob(db,j.id,'alice',env,undefined,model({...structuredClone(base),classification:'not_recipe'}))).job;assert.equal(j.draft?.title,base.title);assert.equal(j.candidate,undefined);assert.ok(j.warnings.some(s=>s.includes('precedente')));
    await handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'text',text:'Altre informazioni della stessa ricetta.'},confirmCost:true}),j.id,db,'alice',env);
    j=(await processImportJob(db,j.id,'alice',env,undefined,(async()=>{throw Error('timeout');}) as typeof fetch)).job;assert.equal(j.status,'ready');assert.equal(j.draft?.title,base.title);assert.ok(j.error);
  }finally{sqlite.close();}
});

test('supplement photos require ownership, stay pinned until release and follow the photo budget',async()=>{
  const {db,sqlite}=fixture();try{
    const bytes=new Uint8Array(readFileSync(new URL('./fixtures/photo.jpeg',import.meta.url))),bucket={get:async()=>({size:bytes.length,arrayBuffer:async()=>bytes.buffer}),delete:async()=>{}} as unknown as R2Bucket;
    sqlite.prepare("INSERT INTO uploads (id,owner_id,name,content_type,created_at,byte_size,state) VALUES ('source','alice','Pagina','image/jpeg','2026-01-01',5,'ready'),('foreign','bob','Pagina','image/jpeg','2026-01-01',5,'ready')").run();
    let j=await initial(db);
    await assert.rejects(()=>handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'photos',photos:['/api/media/foreign']},confirmCost:true}),j.id,db,'alice',env,bucket),/non appartiene/);
    await handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'photos',photos:['/api/media/source']},confirmCost:true}),j.id,db,'alice',env,bucket);
    assert.equal((await cleanupUploads(db,bucket,'alice',Date.now()+48*3600_000)).removed,0);
    const done=await processImportJob(db,j.id,'alice',env,bucket,model(next));assert.equal(done.job.hasPhotos,true);assert.ok(done.job.candidate);
    const calls=sqlite.prepare('SELECT charge FROM ai_import_budget WHERE known=1').all();assert.equal(calls.length,2);
    await handleAiImport(request({action:'discard'}),j.id,db,'alice',env,bucket);assert.equal((await cleanupUploads(db,bucket,'alice',Date.now()+48*3600_000)).removed,1);
  }finally{sqlite.close();}
});

test('supplement attempts count in daily quotas, remain bounded after discard, and budget zero prevents generation',async()=>{
  const {db,sqlite}=fixture();try{
    let j=await initial(db);
    for(let i=0;i<3;i++){
      await handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'text',text:extra+i},confirmCost:true}),j.id,db,'alice',env);
      j=(await processImportJob(db,j.id,'alice',env,undefined,model(next))).job;
      j=await (await handleAiImport(request({action:'rejectCandidate',revision:j.reviewRevision}),j.id,db,'alice',env)).json() as ImportJob;
    }
    await assert.rejects(()=>handleAiImport(request({action:'supplement',revision:j.reviewRevision,input:{kind:'text',text:extra+'four'},confirmCost:true}),j.id,db,'alice',env),/tre integrazioni/);
    await handleAiImport(request({action:'discard'}),j.id,db,'alice',env);
    for(let i=0;i<6;i++)await handleAiImport(request({kind:'text',text:text+i}),undefined,db,'alice',env);
    await assert.rejects(()=>handleAiImport(request({kind:'text',text:text+'limit'}),undefined,db,'alice',env),/Limite beta/);
  }finally{sqlite.close();}
});

test('monitoring is operator-only and reports estimates, reservations, statuses and tokens without private sources',async()=>{
  const {db,sqlite}=fixture();try{
    const j=await initial(db);const api=(owner:string)=>handleApi(request(undefined,'metrics'),{user:{userId:owner},db,importEnv:env});
    assert.equal((await api('bob')).status,403);assert.equal((await handleApi(request(undefined,'metrics'),{user:null,db,importEnv:env})).status,401);
    assert.equal((await handleApi(request(undefined,'metrics'),{user:{userId:'alice'},db,importEnv:{}})).status,403);
    const r=await api('alice');assert.equal(r.status,200);assert.match(r.headers.get('cache-control')??'',/no-store/);const metrics=await r.json() as any;assert.equal(metrics.budget[0].limit,5);assert.equal(metrics.tokens.input,500);assert.equal(metrics.latency.measured,1);assert.equal(JSON.stringify(metrics).includes(j.id),false);assert.equal(JSON.stringify(metrics).includes('pomodoro'),false);
    sqlite.prepare("INSERT INTO ai_import_budget (id,job_id,owner_id,provider,month,charge,known,created_at) VALUES ('uncertain',?,'alice','gemini',?,500000,0,?)").run(j.id,new Date().toISOString().slice(0,7),new Date().toISOString());
    const state=await importMetrics(db,env);assert.equal(state.budget[0].reserved,.5);assert.equal(state.budget[0].uncertain,1);
  }finally{sqlite.close();}
});
