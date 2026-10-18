import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './database.ts';
import {handleAiImport,processImportJob,type ImportJob} from '../lib/ai-import-service.ts';
import {runImportQueue} from '../lib/ai-import-queue.ts';
import {extractionJsonSchema} from '../lib/ai-import-provider.ts';
import {minutesInQuote,validateExtraction,needsMore,recipeFromExtraction,publicImportUrl,type Extraction} from '../lib/ai-import-model.ts';
import {cleanupUploads} from '../lib/media-storage.ts';
import {transcriptFirst,recipeTextWindow} from '../lib/ai-import-text.ts';
import {reserveImportBudget,settleImportBudget} from '../lib/ai-import-budget.ts';

const env={GEMINI_API_KEY:'fixture-only',SUPADATA_API_KEY:'fixture-only',RECIPEEK_IMPORT_QUEUE_TOKEN:'fixture-only'};
const text='Pasta: 200 g pasta. Cuoci la pasta. Per 2 persone. Preparazione 5 minuti. Cottura 10 minuti.';
const ev=(quote:string)=>({sourceId:'text-1',quote});
const draft:Extraction={classification:'recipe',title:'Pasta semplice',description:'',servings:2,prepMinutes:5,cookMinutes:10,servingsEvidence:ev('Per 2 persone'),prepEvidence:ev('Preparazione 5 minuti'),cookEvidence:ev('Cottura 10 minuti'),ingredients:[{id:'i1',name:'pasta',quantity:200,unit:'g',originalText:'200 g pasta',evidence:ev('200 g pasta')}],steps:[{id:'s1',text:'Cuoci la pasta.',ingredientIds:['i1'],evidence:ev('Cuoci la pasta.')}],missing:[],conflicts:[],needsVisual:false,suggestions:[]};
const request=(body:unknown)=>new Request('https://recipeek.test/api/ai-imports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const model=(d:unknown=draft)=>Response.json({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(d)}]}],usage:{total_input_tokens:6000,total_output_tokens:3000,total_thought_tokens:50}});
const create=async(db:ReturnType<typeof fixture>['db'],input:unknown={kind:'text',text})=>(await (await handleAiImport(request(input),undefined,db,'alice',env)).json()) as ImportJob;

test('discarded inputs can be imported again; explicit retries are private, quota-counted and idempotent',async()=>{
  const {db,sqlite}=fixture();try{
    const first=await create(db);await handleAiImport(request({action:'discard'}),first.id,db,'alice',env);
    const [second,duplicate]=await Promise.all([create(db),create(db)]);assert.notEqual(first.id,second.id);assert.equal(second.id,duplicate.id);
    await processImportJob(db,second.id,'alice',env,undefined,(async()=>{throw Error('timeout');}) as typeof fetch);
    await assert.rejects(()=>handleAiImport(request({action:'retry'}),second.id,db,'alice',env),/Conferma/);
    await assert.rejects(()=>handleAiImport(request({action:'retry',confirmCost:true}),second.id,db,'bob',env),/non trovata/);
    const [a,b]=await Promise.all([handleAiImport(request({action:'retry',confirmCost:true}),second.id,db,'alice',env),handleAiImport(request({action:'retry',confirmCost:true}),second.id,db,'alice',env)]);
    const retried=await a.json() as ImportJob;assert.equal(retried.id,(await b.json() as ImportJob).id);assert.notEqual(retried.id,second.id);
    assert.equal((await create(db)).id,retried.id);assert.equal(sqlite.prepare('SELECT count(*) n FROM ai_imports').get()?.n,3);
  }finally{sqlite.close();}
});

test('global leases cap staggered queue ticks at two analyses and one set of photos',async()=>{
  const {db,sqlite}=fixture();try{
    const jobs=[];for(let i=0;i<4;i++)jobs.push(await create(db,{kind:'text',text:text+i}));
    let calls=0;const releases:(()=>void)[]=[];
    const fetcher=(async()=>{calls++;await new Promise<void>(resolve=>releases.push(resolve));return model();}) as typeof fetch;
    const first=runImportQueue(db,env,undefined,fetcher);
    while(calls<2)await new Promise(resolve=>setImmediate(resolve));
    const second=await runImportQueue(db,env,undefined,fetcher);assert.equal(second.processed,0);assert.equal(calls,2);
    releases.forEach(resolve=>resolve());await first;
    const photo={...jobs[2],input:{kind:'photos',photos:['/api/media/a']}};
    sqlite.prepare('UPDATE ai_imports SET document=?,lease=?,lease_until=? WHERE id=?').run(JSON.stringify(photo),'active',Date.now()+45000,jobs[2].id);
    sqlite.prepare('UPDATE ai_imports SET document=? WHERE id=?').run(JSON.stringify({...photo,id:jobs[3].id}),jobs[3].id);
    assert.equal((await processImportJob(db,jobs[3].id,'alice',env,undefined,fetcher)).processed,false);assert.equal(calls,2);
  }finally{sqlite.close();}
});

test('Supadata starts are globally spaced; 429 honors Retry-After and reschedules without restarting unknown jobs',async()=>{
  const {db,sqlite}=fixture();try{
    const a=await create(db,{kind:'url',url:'https://instagram.com/reel/a'}),b=await create(db,{kind:'url',url:'https://instagram.com/reel/b'});
    let calls=0;const fetcher=(async()=>{calls++;return Response.json({description:text});}) as typeof fetch;
    await Promise.all([processImportJob(db,a.id,'alice',env,undefined,fetcher),processImportJob(db,b.id,'alice',env,undefined,fetcher)]);
    assert.equal(calls,1);
    const delayed=sqlite.prepare("SELECT id,attempts,next_run_at FROM ai_imports WHERE status='acquire'").get()!;assert.equal(delayed.attempts,0);assert.ok(Number(delayed.next_run_at)>Date.now());
    sqlite.prepare('DELETE FROM ai_provider_state').run();sqlite.prepare('UPDATE ai_imports SET next_run_at=0 WHERE id=?').run(delayed.id);
    const limited=await processImportJob(db,String(delayed.id),'alice',env,undefined,(async()=>Response.json({error:'limit-exceeded'},{status:429,headers:{'retry-after':'120','x-billable-requests':'0'}})) as typeof fetch);
    assert.equal(limited.job.status,'acquire');assert.equal(limited.job.error,undefined);
    const state=sqlite.prepare('SELECT attempts,next_run_at FROM ai_imports WHERE id=?').get(delayed.id)!;assert.equal(state.attempts,1);assert.ok(Number(state.next_run_at)>Date.now()+115000);
  }finally{sqlite.close();}
});

test('incomplete AI reviews persist with no servings or steps, preserve revision isolation, and cannot become recipes',async()=>{
  const {db,sqlite}=fixture();try{
    const j=await create(db);const ready=await processImportJob(db,j.id,'alice',env,undefined,(async()=>model()) as typeof fetch);
    const recipe={...recipeFromExtraction(draft),title:'',servings:0,ingredients:[],steps:[]};
    const review=await (await handleAiImport(request({action:'review',revision:ready.job.reviewRevision,recipe}),j.id,db,'alice',env)).json() as ImportJob;
    assert.equal((review.review as {recipe:{servings:number}}).recipe.servings,0);
    await assert.rejects(()=>handleAiImport(request({action:'review',revision:ready.job.reviewRevision,recipe}),j.id,db,'alice',env),/cambiata/);
    await assert.rejects(()=>handleAiImport(request({action:'save',revision:review.reviewRevision,recipe,reviewed:true,servingsConfirmed:true}),j.id,db,'alice',env));
    assert.equal(sqlite.prepare('SELECT count(*) n FROM recipes').get()?.n,0);
  }finally{sqlite.close();}
});

test('invalid billed model output retains usage; network failures keep unknown counters instead of zero',async()=>{
  const {db,sqlite}=fixture();try{
    const j=await create(db);const invalid=structuredClone(draft);invalid.ingredients[0].quantity=-1;
    const failed=await processImportJob(db,j.id,'alice',env,undefined,(async()=>model(invalid)) as typeof fetch);
    assert.equal(failed.job.status,'failed');assert.equal(failed.job.usage.length,1);assert.equal(failed.job.usage[0].input,6000);assert.equal(failed.job.usage[0].output,3000);assert.equal(failed.job.usage[0].outcome,'invalid');
    const other=await create(db,{kind:'text',text:text+' network'});const unknown=await processImportJob(db,other.id,'alice',env,undefined,(async()=>{throw Error('network');}) as typeof fetch);
    assert.equal(unknown.job.usage[0].input,null);assert.equal(unknown.job.usage[0].outcome,'unknown');
  }finally{sqlite.close();}
});

test('serving and time evidence verifies values and hour conversions without buying extra material for a formatting error',()=>{
  const changed=structuredClone(draft);changed.servings=99;changed.cookMinutes=900;
  const source=[{id:'text-1',kind:'text' as const,text,label:'Testo'}];
  const warnings=validateExtraction(changed,source).warnings;assert.ok(warnings.some(w=>w.startsWith('Porzioni: valore')));assert.ok(warnings.some(w=>w.startsWith('Cottura: valore')));assert.equal(needsMore(changed,source),false);
  assert.ok(minutesInQuote('1 ora e 30 minuti').includes(90));assert.ok(minutesInQuote('mezza ora').includes(30));assert.ok(minutesInQuote('90 secondi').includes(1.5));assert.deepEqual(minutesInQuote('forno a 180 gradi'),[]);
  const schema=extractionJsonSchema as any;assert.equal(schema.properties.ingredients.items.properties.quantity.minimum,0);assert.ok(schema.properties.ingredients.items.properties.id.description.includes('i'));
  assert.equal(schema.properties.ingredients.maxItems,undefined);assert.equal(schema.properties.suggestions.maxItems,undefined);
  assert.equal(schema.properties.ingredients.description,'At most 80 items.');assert.equal(schema.properties.suggestions.description,'At most 5 items.');
});

test('web evidence ignores Markdown emphasis and understands English minute abbreviations',()=>{
  const d=structuredClone(draft);d.prepEvidence=ev('Preparazione 5 mins');d.cookEvidence=ev('Cottura 10 mins');
  const source=text.replace('Cuoci la pasta.','_Cuoci la pasta._').replace('Preparazione 5 minuti','Preparazione **5 mins**').replace('Cottura 10 minuti','Cottura **10 mins**');
  assert.deepEqual(validateExtraction(d,[{id:'text-1',kind:'web',text:source,label:'Pagina'}]).warnings,[]);
  assert.ok(minutesInQuote('1 hour 30 mins').includes(90));
  d.prepMinutes=50;assert.ok(validateExtraction(d,[{id:'text-1',kind:'web',text:source,label:'Pagina'}]).warnings.some(w=>w.startsWith('Preparazione: valore')));
});

test('transcript timestamp metadata does not invalidate cross-segment quotes or add recipe quantities',()=>{
  const d=structuredClone(draft);d.steps[0].evidence=ev('Cuoci la pasta. Per 2 persone.');d.ingredients[0].evidence=ev('[0s] 200 g pasta');
  const source='[0s] Pasta: 200 g pasta.\n[5.12s] Cuoci la pasta.\n[7s] Per 2 persone.\n[10s] Preparazione 5 minuti.\n[12s] Cottura 10 minuti.';
  const sources=[{id:'text-1',kind:'transcript' as const,text:source,label:'Trascrizione'}];
  assert.deepEqual(validateExtraction(d,sources).warnings,[]);
  d.ingredients[0].quantity=201;assert.ok(validateExtraction(d,sources).warnings.some(w=>w.includes('associazione')));
});

test('visual review keeps one notice and missing evidence; unrelated content has no recipe-completion warnings',()=>{
  const d=structuredClone(draft),sources=[{id:'text-1',kind:'photo' as const,text:'',label:'Pagina'}];
  assert.equal(validateExtraction(d,sources).warnings.length,1);
  d.ingredients[0].evidence.sourceId='absent';assert.ok(validateExtraction(d,sources).warnings.some(w=>w.includes('evidenza assente')));
  const unrelated={...structuredClone(draft),classification:'not_recipe' as const,title:'',ingredients:[],steps:[],servings:null,prepMinutes:null,cookMinutes:null};
  assert.deepEqual(validateExtraction(unrelated,[]),{warnings:[],blocking:['La fonte non contiene una ricetta sufficientemente riconoscibile.']});
});

test('social sharing parameters do not change source identity; website query parameters remain meaningful',()=>{
  assert.equal(publicImportUrl('https://www.tiktok.com/@chef/video/123?is_from_webapp=1&sender_device=pc').href,'https://www.tiktok.com/@chef/video/123');
  assert.equal(publicImportUrl('https://www.instagram.com/reel/ABC/?utm_source=share&rpxt=one&srtk=two').href,'https://www.instagram.com/reel/ABC/');
  assert.equal(publicImportUrl('https://recipes.example.org/page?sender_device=pc&id=2').search,'?sender_device=pc&id=2');
});

test('saved source photos can be released without touching recipe media; initial validation does not buffer photos',async()=>{
  const {db,sqlite}=fixture();try{
    sqlite.prepare("INSERT INTO uploads (id,owner_id,name,content_type,created_at,byte_size,state) VALUES ('source-photo','alice','Pagina','image/jpeg','2026-01-01',5,'ready')").run();
    let reads=0;const bucket={get:async()=>{reads++;throw Error('must not read photo during creation');},delete:async()=>{}} as unknown as R2Bucket;
    const j=await (await handleAiImport(request({kind:'photos',photos:['/api/media/source-photo']}),undefined,db,'alice',env,bucket)).json() as ImportJob;assert.equal(reads,0);
    const saved={...j,status:'saved',reviewRevision:'saved-revision'};
    sqlite.prepare("UPDATE ai_imports SET status='saved',document=? WHERE id=?").run(JSON.stringify(saved),j.id);
    await assert.rejects(()=>handleAiImport(request({action:'removeSources',revision:'saved-revision'}),j.id,db,'bob',env,bucket),/non trovata/);
    const removed=await (await handleAiImport(request({action:'removeSources',revision:'saved-revision'}),j.id,db,'alice',env,bucket)).json() as ImportJob;
    assert.equal(removed.input.kind,'text');assert.equal((await cleanupUploads(db,bucket,'alice',Date.now()+23*3600_000)).removed,0);assert.equal((await cleanupUploads(db,bucket,'alice',Date.now()+25*3600_000)).removed,1);
  }finally{sqlite.close();}
});

test('short promotional captions skip a wasted analysis and long pages keep the ingredient section',()=>{
  assert.equal(transcriptFirst('Pancakes fantastici! Seguimi per altre ricette'),true);
  assert.equal(transcriptFirst('Mescola yogurt e miele.'),false);
  assert.equal(transcriptFirst('100 g yogurt, 1 cucchiaio miele.'),false);
  const web='Introduzione e pubblicità.\n'.repeat(2000)+'# Ingredienti\n200 g pasta\n# Procedimento\nCuoci la pasta.';
  const selected=recipeTextWindow(web);assert.ok(selected.includes('200 g pasta'));assert.ok(selected.length<=24000);
});

test('monthly budget reservations are atomic, keep uncertain charges and count thinking exactly once',async()=>{
  const {db,sqlite}=fixture();try{
    const limited={...env,RECIPEEK_AI_MONTHLY_BUDGET_USD:'2'};
    const results=await Promise.allSettled([reserveImportBudget(db,'a','job-a','alice','gemini','analyze',limited),reserveImportBudget(db,'b','job-b','bob','gemini','analyze',limited)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    const id=String(sqlite.prepare('SELECT id FROM ai_import_budget').get()?.id);
    await settleImportBudget(db,id,'gemini',true,{model:'gemini-3.8-flash',input:null,output:null,thought:null,outcome:'unknown'},null);
    assert.equal(sqlite.prepare('SELECT charge FROM ai_import_budget WHERE id=?').get(id)?.charge,2_000_000);
    await settleImportBudget(db,id,'gemini',true,{model:'gemini-3.8-flash',input:1000,output:200,thought:100,outcome:'invalid'},null);
    assert.equal(sqlite.prepare('SELECT charge FROM ai_import_budget WHERE id=?').get(id)?.charge,1875);
    await reserveImportBudget(db,'sup','job-a','alice','supadata','acquire',{...env,RECIPEEK_SUPADATA_MONTHLY_CREDITS:'1'});
    await assert.rejects(()=>reserveImportBudget(db,'sup2','job-b','bob','supadata','acquire',{...env,RECIPEEK_SUPADATA_MONTHLY_CREDITS:'1'}),/Quota mensile/);
    await settleImportBudget(db,'sup','supadata',true,undefined,'0');assert.equal(sqlite.prepare("SELECT charge FROM ai_import_budget WHERE id='sup'").get()?.charge,0);
  }finally{sqlite.close();}
});

test('budget and optional beta membership stop provider requests before any billable call',async()=>{
  const {db,sqlite}=fixture();try{
    await assert.rejects(()=>handleAiImport(request({kind:'text',text}),undefined,db,'bob',{...env,RECIPEEK_AI_ALLOWED_PROFILES:'alice'}),/riservata/);
    const j=await create(db);let calls=0;
    const blocked=await processImportJob(db,j.id,'alice',{...env,RECIPEEK_AI_MONTHLY_BUDGET_USD:'0'},undefined,(async()=>{calls++;return model();}) as typeof fetch);
    assert.equal(calls,0);assert.equal(blocked.job.status,'failed');assert.ok(blocked.job.error?.includes('Budget mensile'));
  }finally{sqlite.close();}
});
